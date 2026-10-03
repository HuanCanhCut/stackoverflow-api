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
