import { Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../../config/prisma/prisma.service.js'
import { ModerationProducer } from '../../../modules/moderation/moderation.producer.js'
import { ModerationService } from '../../../modules/moderation/moderation.service.js'
import { toPagination } from '../dto/admin-pagination.dto.js'
import {
    AdminModerationDecision,
    AdminQuestionSort,
    AdminQuestionType,
    type GetAdminQuestionsDto,
    type ModerateQuestionDto,
} from './admin-questions.dto.js'

import type { Prisma } from '~/generated/prisma/client.js'

const parentSelect = {
    select: { id: true, title: true, moderation_status: true },
} as const

const tagsInclude = {
    include: { tag: true },
} as const

@Injectable()
export class AdminQuestionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly moderationProducer: ModerationProducer,
        private readonly moderationService: ModerationService,
    ) {}

    async findAll(query: GetAdminQuestionsDto) {
        const { search, type, moderation_status, tag_id, author_id, parent_id, sort, page, per_page } = query

        const where: Prisma.QuestionWhereInput = {
            ...(type === AdminQuestionType.Question && { parent_id: null }),
            ...(type === AdminQuestionType.Answer && { parent_id: { not: null } }),
            ...(parent_id !== undefined && { parent_id }),
            ...(moderation_status && { moderation_status }),
            ...(author_id !== undefined && { author_id }),
            ...(tag_id !== undefined && { tags: { some: { tag_id } } }),
            ...(search && {
                OR: [{ title: { contains: search } }, { body: { contains: search } }],
            }),
        }

        const orderBy: Prisma.QuestionOrderByWithRelationInput[] =
            sort === AdminQuestionSort.Votes
                ? [{ vote_count: 'desc' }, { id: 'desc' }]
                : sort === AdminQuestionSort.Oldest
                  ? [{ created_at: 'asc' }, { id: 'asc' }]
                  : [{ created_at: 'desc' }, { id: 'desc' }]

        const [questions, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy,
                include: {
                    author: true,
                    tags: tagsInclude,
                    parent: parentSelect,
                    _count: { select: { replies: true } },
                },
            }),
            this.prisma.question.count({ where }),
        ])

        const data = questions.map(({ _count, ...question }) => ({ ...question, reply_count: _count.replies }))

        return toPagination(data, total, query)
    }

    async findOne(id: number) {
        const question = await this.prisma.question.findUnique({
            where: { id },
            include: {
                author: true,
                tags: tagsInclude,
                attachments: true,
                parent: parentSelect,
                post_score: true,
                _count: { select: { replies: true, saved_by: true } },
            },
        })

        if (!question) {
            throw new NotFoundException('Câu hỏi không tồn tại')
        }

        const { _count, ...questionData } = question

        return { ...questionData, reply_count: _count.replies, saved_count: _count.saved_by }
    }

    async moderate(id: number, { status, reason }: ModerateQuestionDto) {
        const question = await this.getQuestion(id)
        const isRejected = status === AdminModerationDecision.Rejected

        // Không giữ updated_at: job LLM đang chờ sẽ thấy bài đã đổi và bỏ qua, quyết định của admin được ưu tiên
        const updated = await this.prisma.question.update({
            where: { id },
            data: {
                moderation_status: status,
                moderation_reason: isRejected ? reason : null,
                moderated_at: new Date(),
            },
        })

        if (isRejected && question.moderation_status !== 'rejected') {
            await this.moderationService.notifyRejected({ ...question, categories: [], reason: reason! })
        }

        return updated
    }

    async reModerate(id: number) {
        await this.getQuestion(id)

        const updated = await this.prisma.question.update({
            where: { id },
            data: {
                moderation_status: 'pending',
                moderation_reason: null,
                moderated_at: null,
            },
        })

        await this.moderationProducer.moderateQuestion(updated)

        return updated
    }

    async remove(id: number) {
        await this.getQuestion(id)

        // Replies, tag, vote, attachment... bị xoá theo onDelete: Cascade
        await this.prisma.question.delete({ where: { id } })
    }

    private async getQuestion(id: number) {
        const question = await this.prisma.question.findUnique({
            where: { id },
            select: { id: true, title: true, parent_id: true, author_id: true, moderation_status: true },
        })

        if (!question) {
            throw new NotFoundException('Câu hỏi không tồn tại')
        }

        return question
    }
}
