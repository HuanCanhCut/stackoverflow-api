import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../../config/prisma/prisma.service.js'
import { toPagination } from '../dto/admin-pagination.dto.js'
import { AdminTagSort, type GetAdminTagsDto } from './admin-tags.dto.js'

import type { Prisma } from '~/generated/prisma/client.js'

const questionCount = {
    _count: { select: { questions: true } },
} as const

const withQuestionCount = <T extends { _count: { questions: number } }>({ _count, ...tag }: T) => ({
    ...tag,
    question_count: _count.questions,
})

@Injectable()
export class AdminTagsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(query: GetAdminTagsDto) {
        const { search, sort, page, per_page } = query

        const where: Prisma.TagWhereInput = search ? { name: { contains: search } } : {}

        const orderBy: Prisma.TagOrderByWithRelationInput[] =
            sort === AdminTagSort.Usage
                ? [{ questions: { _count: 'desc' } }, { name: 'asc' }]
                : sort === AdminTagSort.Newest
                  ? [{ created_at: 'desc' }, { id: 'desc' }]
                  : [{ name: 'asc' }, { id: 'asc' }]

        const [tags, total] = await this.prisma.$transaction([
            this.prisma.tag.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy,
                include: questionCount,
            }),
            this.prisma.tag.count({ where }),
        ])

        return toPagination(tags.map(withQuestionCount), total, query)
    }

    async create(name: string) {
        await this.assertNameAvailable(name)

        const tag = await this.prisma.tag.create({ data: { name }, include: questionCount })

        return withQuestionCount(tag)
    }

    async update(id: number, name: string) {
        await this.getTag(id)
        await this.assertNameAvailable(name, id)

        const tag = await this.prisma.tag.update({ where: { id }, data: { name }, include: questionCount })

        return withQuestionCount(tag)
    }

    async remove(id: number) {
        await this.getTag(id)

        // Liên kết question_tags bị xoá theo onDelete: Cascade
        await this.prisma.tag.delete({ where: { id } })
    }

    /** Chuyển toàn bộ câu hỏi của tag nguồn sang tag đích rồi xoá tag nguồn */
    async merge(sourceId: number, targetId: number) {
        if (sourceId === targetId) {
            throw new BadRequestException('Tag đích phải khác tag nguồn')
        }

        await Promise.all([this.getTag(sourceId), this.getTag(targetId)])

        await this.prisma.$transaction(async (tx) => {
            const links = await tx.questionTag.findMany({
                where: { tag_id: sourceId },
                select: { question_id: true },
            })

            // Câu hỏi đã có sẵn tag đích thì bỏ qua
            await tx.questionTag.createMany({
                data: links.map(({ question_id }) => ({ question_id, tag_id: targetId })),
                skipDuplicates: true,
            })

            await tx.tag.delete({ where: { id: sourceId } })
        })

        const tag = await this.prisma.tag.findUniqueOrThrow({ where: { id: targetId }, include: questionCount })

        return withQuestionCount(tag)
    }

    private async getTag(id: number) {
        const tag = await this.prisma.tag.findUnique({ where: { id } })

        if (!tag) {
            throw new NotFoundException('Tag không tồn tại')
        }

        return tag
    }

    private async assertNameAvailable(name: string, exceptId?: number) {
        const existing = await this.prisma.tag.findUnique({ where: { name }, select: { id: true } })

        if (existing && existing.id !== exceptId) {
            throw new ConflictException('Tên tag đã tồn tại')
        }
    }
}
