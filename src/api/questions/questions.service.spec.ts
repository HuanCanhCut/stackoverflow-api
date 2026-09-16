import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../../config/prisma/prisma.service.js'
import type { UploadsService } from '../uploads/uploads.service.js'
import { QuestionsService } from './questions.service.js'

describe('QuestionsService votes', () => {
    const findUnique = vi.fn()
    const update = vi.fn()
    const prisma = {
        question: {
            findUnique,
            update,
        },
    } as unknown as PrismaService
    const uploadsService = {} as UploadsService
    const service = new QuestionsService(prisma, uploadsService)

    beforeEach(() => {
        findUnique.mockReset()
        update.mockReset()
        findUnique.mockResolvedValue({ id: 42 })
    })

    it('atomically increments the question vote count', async () => {
        const updatedQuestion = { id: 42, votes: 8 }
        update.mockResolvedValue(updatedQuestion)

        await expect(service.upvote(42)).resolves.toBe(updatedQuestion)
        expect(update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: {
                votes: { increment: 1 },
            },
        })
    })

    it('atomically decrements the question vote count', async () => {
        const updatedQuestion = { id: 42, votes: -1 }
        update.mockResolvedValue(updatedQuestion)

        await expect(service.downvote(42)).resolves.toBe(updatedQuestion)
        expect(update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: {
                votes: { decrement: 1 },
            },
        })
    })

    it('throws a not found error without updating when the question does not exist', async () => {
        findUnique.mockResolvedValue(null)

        await expect(service.upvote(404)).rejects.toBeInstanceOf(NotFoundException)
        expect(update).not.toHaveBeenCalled()
    })
})
