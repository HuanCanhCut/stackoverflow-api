import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../../config/prisma/prisma.service.js'
import { calculateQuestionScore, QuestionScoreService } from './question_score.service.js'

describe('calculateQuestionScore', () => {
    const calculatedAt = new Date('2026-09-15T12:00:00.000Z')

    it('increases when a question has more votes', () => {
        const createdAt = new Date('2026-09-15T11:00:00.000Z')
        const lowVoteScore = calculateQuestionScore({ votes: 1, createdAt, calculatedAt })
        const highVoteScore = calculateQuestionScore({ votes: 10, createdAt, calculatedAt })

        expect(highVoteScore).toBeGreaterThan(lowVoteScore)
    })

    it('decreases as a question gets older', () => {
        const recentScore = calculateQuestionScore({
            votes: 10,
            createdAt: new Date('2026-09-15T11:00:00.000Z'),
            calculatedAt,
        })
        const oldScore = calculateQuestionScore({
            votes: 10,
            createdAt: new Date('2026-09-10T12:00:00.000Z'),
            calculatedAt,
        })

        expect(oldScore).toBeLessThan(recentScore)
    })
})

describe('QuestionScoreService', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('only queries the last 7 days and limits concurrent score updates to 100', async () => {
        vi.useFakeTimers()
        const calculatedAt = new Date('2026-09-15T12:00:00.000Z')
        vi.setSystemTime(calculatedAt)

        const questions = Array.from({ length: 205 }, (_, index) => ({
            id: index + 1,
            votes: index,
            created_at: new Date('2026-09-15T11:00:00.000Z'),
        }))
        let activeUpdates = 0
        let maxActiveUpdates = 0
        const findMany = vi.fn().mockResolvedValue(questions)
        const upsert = vi.fn(async () => {
            activeUpdates += 1
            maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates)
            await new Promise<void>((resolve) => setTimeout(resolve, 1))
            activeUpdates -= 1
        })
        const prisma = {
            question: { findMany },
            postScore: { upsert },
        } as unknown as PrismaService
        const service = new QuestionScoreService(prisma)

        const calculation = service.calculateRecentQuestionScores()
        await vi.runAllTimersAsync()
        await calculation

        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    created_at: {
                        gte: new Date('2026-09-08T12:00:00.000Z'),
                    },
                },
            }),
        )
        expect(upsert).toHaveBeenCalledTimes(205)
        expect(maxActiveUpdates).toBe(100)
    })
})
