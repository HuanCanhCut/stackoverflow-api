import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import { UploadsService } from '../uploads/uploads.service.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { GetQuestionRepliesDto, QuestionRepliesOrderBy } from './dto/get-question-replies.dto.js'
import { GetQuestionsDto } from './dto/get-questions.dto.js'
import { GetSavedQuestionsDto } from './dto/get-saved-questions.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'

import { S3Folder } from '~/types/s3.type.js'

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

export enum VoteType {
    Upvote = 1,
    Downvote = -1,
}

@Injectable()
export class QuestionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly uploadService: UploadsService,
    ) {}

    private async resolveTags(tx: TransactionClient, inputTags: CreateQuestionDto['tags']) {
        const tagIds = inputTags.filter((tag) => tag.id !== null).map((tag) => tag.id!)

        const existingTags = await tx.tag.findMany({
            where: {
                id: {
                    in: tagIds,
                },
            },
        })

        const existingTagIds = new Set(existingTags.map((tag) => tag.id))

        const tagsNotExists = inputTags.filter((tag) => tag.id === null || !existingTagIds.has(tag.id))

        const tagNames = [...new Set(tagsNotExists.map((tag) => tag.name.trim()))]

        await tx.tag.createMany({
            data: tagNames.map((name) => ({
                name,
            })),
            skipDuplicates: true,
        })

        const newTags = await tx.tag.findMany({
            where: {
                name: {
                    in: tagNames,
                },
            },
        })

        return [...existingTags, ...newTags]
    }

    /**
     * Gắn trạng thái của người xem (đã vote gì, đã lưu chưa) vào danh sách câu hỏi.
     * Khách (không đăng nhập) luôn nhận my_vote = 0, is_saved = false.
     */
    private async withViewerState<T extends { id: number }>(questions: T[], currentUserId?: number) {
        if (currentUserId === undefined || questions.length === 0) {
            return questions.map((question) => ({ ...question, my_vote: 0, is_saved: false }))
        }

        const questionIds = questions.map((question) => question.id)

        const [votes, savedQuestions] = await this.prisma.$transaction([
            this.prisma.questionVote.findMany({
                where: { user_id: currentUserId, question_id: { in: questionIds } },
                select: { question_id: true, value: true },
            }),
            this.prisma.savedQuestion.findMany({
                where: { user_id: currentUserId, question_id: { in: questionIds } },
                select: { question_id: true },
            }),
        ])

        const voteByQuestionId = new Map(votes.map((vote) => [vote.question_id, vote.value]))
        const savedQuestionIds = new Set(savedQuestions.map((saved) => saved.question_id))

        return questions.map((question) => ({
            ...question,
            my_vote: voteByQuestionId.get(question.id) ?? 0,
            is_saved: savedQuestionIds.has(question.id),
        }))
    }

    async create(createQuestionDto: CreateQuestionDto, authorId: number) {
        const objectKeys = await this.uploadService.verifyUploadIds({
            uploadIds: createQuestionDto.upload_ids,
            currentUserId: authorId,
            folder: S3Folder.QUESTIONS,
        })

        return this.prisma.$transaction(async (tx) => {
            if (createQuestionDto.parent_id != null) {
                const parent = await tx.question.findUnique({
                    where: {
                        id: createQuestionDto.parent_id,
                    },
                    select: {
                        id: true,
                    },
                })

                if (!parent) {
                    throw new NotFoundException('Parent question not found')
                }
            }

            const tags = await this.resolveTags(tx, createQuestionDto.tags)

            return tx.question.create({
                data: {
                    title: createQuestionDto.title,
                    body: createQuestionDto.body,
                    author_id: authorId,
                    parent_id: createQuestionDto.parent_id,

                    tags: {
                        createMany: {
                            data: tags.map((tag) => ({
                                tag_id: tag.id,
                            })),
                            skipDuplicates: true,
                        },
                    },
                    attachments: {
                        createMany: {
                            data: objectKeys.map((key) => ({
                                object_key: key,
                            })),
                            skipDuplicates: true,
                        },
                    },
                },
                include: {
                    tags: {
                        include: {
                            tag: true,
                        },
                    },
                    attachments: true,
                },
            })
        })
    }

    async findAll({ tag_id, page, per_page }: GetQuestionsDto, currentUserId?: number) {
        const where = {
            parent_id: null,
            ...(tag_id !== undefined && {
                tags: {
                    some: {
                        tag_id,
                    },
                },
            }),
        }

        const [questions, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [
                    {
                        post_score: {
                            score: 'desc',
                        },
                    },
                    { created_at: 'desc' },
                    { id: 'desc' },
                ],
                include: {
                    author: true,
                    tags: {
                        include: {
                            tag: true,
                        },
                    },
                    attachments: true,
                    post_score: true,
                    _count: {
                        select: {
                            replies: true,
                        },
                    },
                },
            }),
            this.prisma.question.count({
                where,
            }),
        ])

        const questionsWithReplyCount = questions.map(({ _count, ...question }) => ({
            ...question,
            reply_count: _count.replies,
        }))

        return {
            data: await this.withViewerState(questionsWithReplyCount, currentUserId),
            total,
            count: questionsWithReplyCount.length,
            current_page: page,
            per_page,
        }
    }

    async findOne(id: number, currentUserId?: number) {
        const question = await this.prisma.question.findUnique({
            where: {
                id,
            },
            include: {
                author: true,
                tags: {
                    include: {
                        tag: true,
                    },
                },
                attachments: true,
                post_score: true,
                _count: {
                    select: {
                        replies: true,
                    },
                },
            },
        })

        if (!question) {
            throw new NotFoundException('Question not found')
        }

        const { _count, ...questionData } = question

        const [questionWithViewerState] = await this.withViewerState(
            [{ ...questionData, reply_count: _count.replies }],
            currentUserId,
        )

        return questionWithViewerState
    }

    async findSavedQuestions(currentUserId: number, { page, per_page }: GetSavedQuestionsDto) {
        const where = {
            user_id: currentUserId,
        }

        const [savedQuestions, total] = await this.prisma.$transaction([
            this.prisma.savedQuestion.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [{ created_at: 'desc' }, { question_id: 'desc' }],
                include: {
                    question: {
                        include: {
                            author: true,
                            tags: {
                                include: {
                                    tag: true,
                                },
                            },
                            attachments: true,
                            post_score: true,
                            _count: {
                                select: {
                                    replies: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.savedQuestion.count({ where }),
        ])

        const data = savedQuestions.map(({ created_at, question: { _count, ...question } }) => ({
            ...question,
            reply_count: _count.replies,
            saved_at: created_at,
        }))

        return {
            data,
            total,
            count: data.length,
            current_page: page,
            per_page,
        }
    }

    async saveQuestion(id: number, currentUserId: number) {
        const question = await this.prisma.question.findFirst({
            where: {
                id,
                parent_id: null,
            },
            select: {
                id: true,
            },
        })

        if (!question) {
            throw new NotFoundException('Question not found')
        }

        return this.prisma.savedQuestion.upsert({
            where: {
                user_id_question_id: {
                    user_id: currentUserId,
                    question_id: id,
                },
            },
            update: {},
            create: {
                user_id: currentUserId,
                question_id: id,
            },
        })
    }

    async removeSavedQuestion(id: number, currentUserId: number) {
        const { count } = await this.prisma.savedQuestion.deleteMany({
            where: {
                user_id: currentUserId,
                question_id: id,
            },
        })

        if (count === 0) {
            throw new NotFoundException('Saved question not found')
        }
    }

    async findReplies(parentId: number, { order_by, page, per_page }: GetQuestionRepliesDto, currentUserId?: number) {
        const parent = await this.prisma.question.findUnique({
            where: {
                id: parentId,
            },
            select: {
                id: true,
            },
        })

        if (!parent) {
            throw new NotFoundException('Question not found')
        }

        const [replies, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where: {
                    parent_id: parentId,
                },
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy:
                    order_by === QuestionRepliesOrderBy.Vote
                        ? [{ vote_count: 'desc' }, { created_at: 'desc' }, { id: 'desc' }]
                        : [{ created_at: 'desc' }, { id: 'desc' }],
                include: {
                    author: true,
                    tags: {
                        include: {
                            tag: true,
                        },
                    },
                    attachments: true,
                    post_score: true,
                    _count: {
                        select: {
                            replies: true,
                        },
                    },
                },
            }),
            this.prisma.question.count({
                where: {
                    parent_id: parentId,
                },
            }),
        ])

        // Comment lồng nhiều cấp: client cần reply_count để biết comment nào còn có phản hồi con
        const repliesWithReplyCount = replies.map(({ _count, ...reply }) => ({
            ...reply,
            reply_count: _count.replies,
        }))

        return {
            data: await this.withViewerState(repliesWithReplyCount, currentUserId),
            total,
            count: replies.length,
            current_page: page,
            per_page,
        }
    }

    /**
     * Vote kiểu toggle: vote lại cùng chiều thì bỏ vote, vote ngược chiều thì đổi vote.
     * vote_count được cập nhật theo chênh lệch trong cùng transaction.
     */
    async vote({ id, type, currentUserId }: { id: number; type: VoteType; currentUserId: number }) {
        return this.prisma.$transaction(async (tx) => {
            const question = await tx.question.findUnique({
                where: {
                    id,
                },
                select: {
                    id: true,
                },
            })

            if (!question) {
                throw new NotFoundException('Question not found')
            }

            const where = {
                user_id_question_id: {
                    user_id: currentUserId,
                    question_id: id,
                },
            }

            const existingVote = await tx.questionVote.findUnique({ where })
            const previousValue = existingVote?.value ?? 0
            const nextValue = previousValue === type ? 0 : type

            if (nextValue === 0) {
                await tx.questionVote.delete({ where })
            } else if (existingVote) {
                await tx.questionVote.update({ where, data: { value: nextValue } })
            } else {
                await tx.questionVote.create({
                    data: {
                        user_id: currentUserId,
                        question_id: id,
                        value: nextValue,
                    },
                })
            }

            const updatedQuestion = await tx.question.update({
                where: {
                    id,
                },
                data: {
                    vote_count: { increment: nextValue - previousValue },
                },
                select: {
                    id: true,
                    vote_count: true,
                },
            })

            return {
                ...updatedQuestion,
                my_vote: nextValue,
            }
        })
    }

    async update({
        id,
        updateQuestionDto,
        currentUserId,
    }: {
        id: number
        updateQuestionDto: UpdateQuestionDto
        currentUserId: number
    }) {
        return this.prisma.$transaction(async (tx) => {
            const question = await tx.question.findUnique({
                where: {
                    id,
                },
            })

            if (!question) {
                throw new NotFoundException('Question not found')
            }

            if (question.author_id !== currentUserId) {
                throw new BadRequestException('You are not the author of this question')
            }

            const tags = updateQuestionDto.tags ? await this.resolveTags(tx, updateQuestionDto.tags) : undefined

            return tx.question.update({
                where: {
                    id,
                },
                data: {
                    title: updateQuestionDto.title,
                    body: updateQuestionDto.body,

                    ...(tags !== undefined && {
                        tags: {
                            deleteMany: {},
                            createMany: {
                                data: tags.map((tag) => ({
                                    tag_id: tag.id,
                                })),
                                skipDuplicates: true,
                            },
                        },
                    }),
                },
                include: {
                    tags: {
                        include: {
                            tag: true,
                        },
                    },
                },
            })
        })
    }

    async remove({ id, currentUserId }: { id: number; currentUserId: number }) {
        const question = await this.prisma.question.findUnique({
            where: {
                id,
            },
        })

        if (question?.author_id !== currentUserId) {
            throw new ForbiddenException('You are not the author of this question')
        }

        await this.prisma.question.delete({
            where: {
                id,
            },
        })

        return
    }
}
