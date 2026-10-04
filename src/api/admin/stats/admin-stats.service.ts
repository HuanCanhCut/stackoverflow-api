import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../config/prisma/prisma.service.js'
import type { GetStatsDto } from './get-stats.dto.js'

const DAY_MS = 24 * 60 * 60 * 1000

const toDateKey = (date: Date) => date.toISOString().slice(0, 10)

@Injectable()
export class AdminStatsService {
    constructor(private readonly prisma: PrismaService) {}

    async getStats({ days }: GetStatsDto) {
        // Gom theo ngày UTC (created_at lưu UTC), tính cả hôm nay
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        const since = new Date(today.getTime() - (days - 1) * DAY_MS)

        const [
            totalUsers,
            blockedUsers,
            adminUsers,
            newUsers,
            totalQuestions,
            totalAnswers,
            newQuestions,
            newAnswers,
            moderationGroups,
            totalTags,
        ] = await this.prisma.$transaction([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { is_blocked: true } }),
            this.prisma.user.count({ where: { role: 'admin' } }),
            this.prisma.user.count({ where: { created_at: { gte: since } } }),
            this.prisma.question.count({ where: { parent_id: null } }),
            this.prisma.question.count({ where: { parent_id: { not: null } } }),
            this.prisma.question.count({ where: { parent_id: null, created_at: { gte: since } } }),
            this.prisma.question.count({ where: { parent_id: { not: null }, created_at: { gte: since } } }),
            this.prisma.question.groupBy({
                by: ['moderation_status'],
                orderBy: { moderation_status: 'asc' },
                _count: { _all: true },
            }),
            this.prisma.tag.count(),
        ])

        const moderation = { pending: 0, approved: 0, rejected: 0 }

        for (const group of moderationGroups) {
            moderation[group.moderation_status] = (group._count as { _all: number })._all
        }

        return {
            users: { total: totalUsers, blocked: blockedUsers, admins: adminUsers, new: newUsers },
            questions: { total: totalQuestions, new: newQuestions },
            answers: { total: totalAnswers, new: newAnswers },
            moderation,
            tags: { total: totalTags },
            days,
            series: await this.getDailySeries(since, days),
        }
    }

    private async getDailySeries(since: Date, days: number) {
        const [userRows, questionRows] = await Promise.all([
            this.prisma.$queryRaw<{ date: string; users: bigint | number }[]>`
                SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS users
                FROM users
                WHERE created_at >= ${since}
                GROUP BY date
            `,
            this.prisma.$queryRaw<
                { date: string; questions: bigint | number | string; answers: bigint | number | string }[]
            >`
                SELECT
                    DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
                    SUM(parent_id IS NULL) AS questions,
                    SUM(parent_id IS NOT NULL) AS answers
                FROM questions
                WHERE created_at >= ${since}
                GROUP BY date
            `,
        ])

        const usersByDate = new Map(userRows.map((row) => [row.date, Number(row.users)]))
        const questionsByDate = new Map(questionRows.map((row) => [row.date, row]))

        // Điền đủ các ngày không có dữ liệu để client vẽ biểu đồ liền mạch
        return Array.from({ length: days }, (_, index) => {
            const date = toDateKey(new Date(since.getTime() + index * DAY_MS))
            const questionRow = questionsByDate.get(date)

            return {
                date,
                users: usersByDate.get(date) ?? 0,
                questions: Number(questionRow?.questions ?? 0),
                answers: Number(questionRow?.answers ?? 0),
            }
        })
    }
}
