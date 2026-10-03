import { Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import type { GetUserQuestionsDto } from './dto/get-user-questions.dto.js'

import type { Prisma } from '~/generated/prisma/client.js'

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async findQuestions(userId: number, query: GetUserQuestionsDto) {
        await this.ensureUserExists(userId)

        return this.getPaginatedQuestions({
            ...query,
            where: {
                author_id: userId,
                parent_id: null,
            },
        })
    }

    async findAnsweredQuestions(userId: number, query: GetUserQuestionsDto) {
        await this.ensureUserExists(userId)

        return this.getPaginatedQuestions({
            ...query,
            where: {
                parent_id: null,
                replies: {
                    some: {
                        author_id: userId,
                    },
                },
            },
        })
    }

    // Danh sách câu trả lời do chính người dùng viết: mọi bài có parent_id (trả lời câu hỏi
    // hoặc phản hồi câu trả lời khác). Kèm root_question_id là bài gốc để điều hướng.
    async findAnswers(userId: number, { page, per_page }: GetUserQuestionsDto) {
        await this.ensureUserExists(userId)

        const where: Prisma.QuestionWhereInput = {
            author_id: userId,
            parent_id: { not: null },
            moderation_status: { not: 'rejected' },
        }

        const [answers, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
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
                            replies: { where: { moderation_status: { not: 'rejected' } } },
                        },
                    },
                },
            }),
            this.prisma.question.count({ where }),
        ])

        const rootIds = await Promise.all(answers.map((answer) => this.findRootQuestionId(answer.parent_id!)))

        const data = answers.map(({ _count, ...answer }, index) => ({
            ...answer,
            reply_count: _count.replies,
            root_question_id: rootIds[index],
        }))

        return {
            data,
            total,
            count: data.length,
            current_page: page,
            per_page,
        }
    }

    // Đi ngược lên cây cha-con để tìm câu hỏi gốc (bài có parent_id = null)
    private async findRootQuestionId(startId: number) {
        let currentId = startId

        for (let i = 0; i < 50; i++) {
            const node = await this.prisma.question.findUnique({
                where: { id: currentId },
                select: { id: true, parent_id: true },
            })

            if (!node) return currentId
            if (node.parent_id == null) return node.id

            currentId = node.parent_id
        }

        return currentId
    }

    private async ensureUserExists(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
            },
        })

        if (!user) {
            throw new NotFoundException('User not found')
        }
    }

    private async getPaginatedQuestions({
        where,
        page,
        per_page,
    }: GetUserQuestionsDto & {
        where: Prisma.QuestionWhereInput
    }) {
        // Không liệt kê nội dung bị kiểm duyệt ẩn đi
        const visibleWhere: Prisma.QuestionWhereInput = { AND: [where, { moderation_status: { not: 'rejected' } }] }

        const [questions, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where: visibleWhere,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
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
                            replies: { where: { moderation_status: { not: 'rejected' } } },
                        },
                    },
                },
            }),
            this.prisma.question.count({ where: visibleWhere }),
        ])

        const data = questions.map(({ _count, ...question }) => ({
            ...question,
            reply_count: _count.replies,
        }))

        return {
            data,
            total,
            count: data.length,
            current_page: page,
            per_page,
        }
    }
}
