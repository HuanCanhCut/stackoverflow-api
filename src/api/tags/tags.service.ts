import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import type { GetTagsDto } from './dto/get-tags.dto.js'

@Injectable()
export class TagsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll({ page, per_page }: GetTagsDto) {
        const [tags, total] = await this.prisma.$transaction([
            this.prisma.tag.findMany({
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                include: {
                    _count: {
                        select: {
                            questions: {
                                where: {
                                    question: {
                                        parent_id: null,
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.tag.count(),
        ])

        const data = tags.map(({ _count, ...tag }) => ({
            ...tag,
            question_count: _count.questions,
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
