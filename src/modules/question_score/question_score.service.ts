import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import chunk from 'lodash/chunk.js'

import { PrismaService } from '../../config/prisma/prisma.service.js'

const BATCH_CONCURRENCY = 100
const RECENT_QUESTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000
const HOUR_IN_MS = 60 * 60 * 1_000
const GRAVITY = 1.5
const AGE_OFFSET_HOURS = 2

export const calculateQuestionScore = ({
    votes,
    createdAt,
    calculatedAt,
}: {
    votes: number
    createdAt: Date
    calculatedAt: Date
}) => {
    const ageHours = Math.max(0, (calculatedAt.getTime() - createdAt.getTime()) / HOUR_IN_MS)
    const voteWeight = Math.max(0, votes) + 1

    return voteWeight / Math.pow(ageHours + AGE_OFFSET_HOURS, GRAVITY)
}

@Injectable()
export class QuestionScoreService {
    private readonly logger = new Logger(QuestionScoreService.name)

    constructor(private readonly prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_5_MINUTES, {
        name: 'calculate-question-scores',
        waitForCompletion: true,
    })
    async calculateRecentQuestionScores() {
        const calculatedAt = new Date()
        const createdAfter = new Date(calculatedAt.getTime() - RECENT_QUESTION_WINDOW_MS)
        const questions = await this.prisma.question.findMany({
            where: {
                created_at: {
                    gte: createdAfter,
                },
            },
            select: {
                id: true,
                votes: true,
                created_at: true,
            },
        })

        for (const questionBatch of chunk(questions, BATCH_CONCURRENCY)) {
            await Promise.all(
                questionBatch.map((question) => {
                    const score = calculateQuestionScore({
                        votes: question.votes,
                        createdAt: question.created_at,
                        calculatedAt,
                    })

                    return this.prisma.postScore.upsert({
                        where: {
                            question_id: question.id,
                        },
                        create: {
                            question_id: question.id,
                            score,
                            calculated_at: calculatedAt,
                        },
                        update: {
                            score,
                            calculated_at: calculatedAt,
                        },
                    })
                }),
            )
        }

        this.logger.log(`Calculated scores for ${questions.length} recent questions`)
    }
}
