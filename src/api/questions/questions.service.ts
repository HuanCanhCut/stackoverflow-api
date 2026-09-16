import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import { UploadsService } from '../uploads/uploads.service.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { GetQuestionsDto } from './dto/get-questions.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'

import { S3Folder } from '~/types/s3.type.js'

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

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

    async findAll({ page, per_page }: GetQuestionsDto) {
        const [questions, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where: {
                    parent_id: null,
                },
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
                where: {
                    parent_id: null,
                },
            }),
        ])

        const questionsWithReplyCount = questions.map(({ _count, ...question }) => ({
            ...question,
            reply_count: _count.replies,
        }))

        return {
            data: questionsWithReplyCount,
            total,
            count: questionsWithReplyCount.length,
            current_page: page,
            per_page,
        }
    }

    async findOne(id: number) {
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

        return {
            ...questionData,
            reply_count: _count.replies,
        }
    }

    async upvote(id: number) {
        return this.updateVotes(id, 'increment')
    }

    async downvote(id: number) {
        return this.updateVotes(id, 'decrement')
    }

    private async updateVotes(id: number, operation: 'increment' | 'decrement') {
        const question = await this.prisma.question.findUnique({
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

        return this.prisma.question.update({
            where: {
                id,
            },
            data: {
                vote_count: operation === 'increment' ? { increment: 1 } : { decrement: 1 },
            },
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
