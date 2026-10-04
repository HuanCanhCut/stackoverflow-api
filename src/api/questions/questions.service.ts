import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import { ModerationProducer } from '../../modules/moderation/moderation.producer.js'
import { SocketEvent } from '../../modules/socket/socket.enum.js'
import { SocketGateway } from '../../modules/socket/socket.gateway.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { UploadsService } from '../uploads/uploads.service.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { GetQuestionRepliesDto, QuestionRepliesOrderBy } from './dto/get-question-replies.dto.js'
import { GetQuestionsDto } from './dto/get-questions.dto.js'
import { GetSavedQuestionsDto } from './dto/get-saved-questions.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'

import type { Prisma } from '~/generated/prisma/client.js'
import { S3Folder } from '~/types/s3.type.js'

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

// Nội dung bị LLM đánh giá vi phạm sẽ bị ẩn với mọi người, trừ tác giả (để xem lý do)
const NOT_REJECTED = { moderation_status: { not: 'rejected' as const } }

const visibleTo = (currentUserId?: number) =>
    currentUserId === undefined ? NOT_REJECTED : { OR: [NOT_REJECTED, { author_id: currentUserId }] }

// Chỉ đếm phản hồi không bị ẩn
const visibleReplyCount = {
    _count: {
        select: {
            replies: { where: NOT_REJECTED },
        },
    },
}

export enum VoteType {
    Upvote = 1,
    Downvote = -1,
}

@Injectable()
export class QuestionsService {
    private readonly logger = new Logger(QuestionsService.name)

    constructor(
        private readonly prisma: PrismaService,
        private readonly uploadService: UploadsService,
        private readonly moderationProducer: ModerationProducer,
        private readonly notificationsService: NotificationsService,
        private readonly socketGateway: SocketGateway,
    ) {}

    // Tìm id câu hỏi gốc (top-level) bằng cách đi ngược theo parent_id.
    // Dùng để điều hướng thông báo về đúng trang câu hỏi chứa câu trả lời.
    private async findRootQuestionId(questionId: number): Promise<number> {
        let currentId = questionId

        // Giới hạn vòng lặp để phòng dữ liệu lỗi gây lặp vô hạn
        for (let i = 0; i < 20; i++) {
            const node = await this.prisma.question.findUnique({
                where: { id: currentId },
                select: { parent_id: true },
            })

            if (!node || node.parent_id == null) break

            currentId = node.parent_id
        }

        return currentId
    }

    // Lấy tên hiển thị của user để ghép vào nội dung thông báo.
    // full_name là field tính toán nên tự ghép từ first_name + last_name.
    private async getUserDisplayName(userId: number): Promise<string> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { first_name: true, last_name: true },
        })

        return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Ai đó'
    }

    // Tạo thông báo và đẩy realtime tới người nhận. Lỗi thông báo không được ảnh hưởng hành động chính.
    private async notifyPostAuthor({
        content,
        metadata,
        recipientId,
        actorId,
    }: {
        content: string
        metadata: Record<string, unknown>
        recipientId: number
        actorId: number
    }) {
        try {
            const notification = await this.notificationsService.create({
                content,
                metadata,
                recipient_ids: [recipientId],
                actorId,
            })

            this.socketGateway.emitToUser(recipientId, SocketEvent.NOTIFICATION_CREATED, {
                id: notification.id,
                content,
            })
        } catch (error) {
            this.logger.error(`Không thể tạo thông báo cho user ${recipientId}`, error as Error)
        }
    }

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

        const question = await this.prisma.$transaction(async (tx) => {
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

        await this.moderationProducer.moderateQuestion(question)

        // Có người trả lời/phản hồi -> thông báo cho tác giả của bài bị trả lời (bỏ qua nếu tự trả lời mình)
        if (createQuestionDto.parent_id != null) {
            const parent = await this.prisma.question.findUnique({
                where: { id: createQuestionDto.parent_id },
                select: { author_id: true, parent_id: true },
            })

            if (parent && parent.author_id !== authorId) {
                const rootId = await this.findRootQuestionId(createQuestionDto.parent_id)
                const actorName = await this.getUserDisplayName(authorId)
                // parent là câu hỏi gốc -> "trả lời câu hỏi", parent là câu trả lời -> "phản hồi câu trả lời"
                const repliedToQuestion = parent.parent_id == null

                await this.notifyPostAuthor({
                    content: `${actorName} đã ${repliedToQuestion ? 'trả lời câu hỏi' : 'phản hồi câu trả lời'} của bạn`,
                    metadata: { type: 'answer', question_id: rootId },
                    recipientId: parent.author_id,
                    actorId: authorId,
                })
            }
        }

        return question
    }

    async findAll({ tag_id, search, page, per_page }: GetQuestionsDto, currentUserId?: number) {
        const where: Prisma.QuestionWhereInput = {
            parent_id: null,
            ...NOT_REJECTED,
            ...(tag_id !== undefined && {
                tags: {
                    some: {
                        tag_id,
                    },
                },
            }),
            // Tìm theo tiêu đề hoặc nội dung; collation MySQL mặc định đã không phân biệt hoa thường
            ...(search && {
                OR: [
                    {
                        title: {
                            contains: search,
                        },
                    },
                    {
                        body: {
                            contains: search,
                        },
                    },
                ],
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
                    ...visibleReplyCount,
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
                ...visibleReplyCount,
            },
        })

        if (!question || (question.moderation_status === 'rejected' && question.author_id !== currentUserId)) {
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
            question: NOT_REJECTED,
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
                            ...visibleReplyCount,
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

        const where = {
            parent_id: parentId,
            ...visibleTo(currentUserId),
        }

        const [replies, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where,
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
                    ...visibleReplyCount,
                },
            }),
            this.prisma.question.count({
                where,
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
        const { result, authorId, parentId, nextValue } = await this.prisma.$transaction(async (tx) => {
            const question = await tx.question.findUnique({
                where: {
                    id,
                },
                select: {
                    id: true,
                    author_id: true,
                    parent_id: true,
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
            // Giá trị lưu trong DB là số (1 / -1), 0 nghĩa là bỏ vote
            const nextValue: VoteType | 0 = previousValue === Number(type) ? 0 : type

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
                result: {
                    ...updatedQuestion,
                    my_vote: nextValue,
                },
                authorId: question.author_id,
                parentId: question.parent_id,
                nextValue,
            }
        })

        // Chỉ thông báo khi nhận upvote (bỏ qua bỏ vote/downvote và tự vote bài của mình)
        if (nextValue === VoteType.Upvote && authorId !== currentUserId) {
            const rootId = await this.findRootQuestionId(id)
            const actorName = await this.getUserDisplayName(currentUserId)
            // parent_id null -> đây là câu hỏi, ngược lại là câu trả lời
            const isQuestion = parentId == null

            await this.notifyPostAuthor({
                content: `${actorName} đã bình chọn ${isQuestion ? 'câu hỏi' : 'câu trả lời'} của bạn`,
                metadata: { type: 'vote', question_id: rootId },
                recipientId: authorId,
                actorId: currentUserId,
            })
        }

        return result
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
        const { updatedQuestion, contentChanged } = await this.prisma.$transaction(async (tx) => {
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
            // Sửa tiêu đề / nội dung thì phải kiểm duyệt lại, chỉ sửa tag thì không
            const contentChanged =
                (updateQuestionDto.title !== undefined && updateQuestionDto.title !== question.title) ||
                (updateQuestionDto.body !== undefined && updateQuestionDto.body !== question.body)

            const updatedQuestion = await tx.question.update({
                where: {
                    id,
                },
                data: {
                    title: updateQuestionDto.title,
                    body: updateQuestionDto.body,

                    ...(contentChanged && {
                        moderation_status: 'pending',
                        moderation_reason: null,
                        moderated_at: null,
                    }),

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

            return { updatedQuestion, contentChanged }
        })

        if (contentChanged) {
            await this.moderationProducer.moderateQuestion(updatedQuestion)
        }

        return updatedQuestion
    }

    async remove({ id, currentUserId }: { id: number; currentUserId: number }) {
        const question = await this.prisma.question.findUnique({
            where: {
                id,
            },
        })

        if (!question) {
            throw new NotFoundException('Question not found')
        }

        if (question.author_id !== currentUserId) {
            throw new ForbiddenException('You are not the author of this question')
        }

        // Xóa câu hỏi kèm toàn bộ câu trả lời (bao gồm cả reply lồng nhau).
        // FK tự tham chiếu parent_id khai báo ON DELETE CASCADE nhưng MySQL/MariaDB không kích hoạt
        // cascade cho quan hệ self-reference, nên phải tự gom và xóa các reply con cháu.
        // Các bảng liên quan khác (votes, tags, attachments, saved, post_score) vẫn tự cascade theo question_id.
        await this.prisma.$transaction(async (tx) => {
            // Gom id các reply theo từng tầng (BFS): levels[0] là reply trực tiếp, sâu dần về sau
            const levels: number[][] = []
            let parentIds = [id]

            while (parentIds.length > 0) {
                const replies = await tx.question.findMany({
                    where: {
                        parent_id: { in: parentIds },
                    },
                    select: {
                        id: true,
                    },
                })

                parentIds = replies.map((reply) => reply.id)

                if (parentIds.length > 0) {
                    levels.push(parentIds)
                }
            }

            // Xóa từ tầng sâu nhất lên để không vi phạm khóa ngoại parent_id, cuối cùng mới xóa câu hỏi gốc
            for (let i = levels.length - 1; i >= 0; i--) {
                await tx.question.deleteMany({
                    where: {
                        id: { in: levels[i] },
                    },
                })
            }

            await tx.question.delete({
                where: {
                    id,
                },
            })
        })

        return
    }
}
