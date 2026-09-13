import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'

@Injectable()
export class QuestionsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(createQuestionDto: CreateQuestionDto, authorId: number) {
        return this.prisma.$transaction(async (tx) => {
            /**
             * Check tag exist
             *  - If exist, return tag
             *  - If not exist, create tag
             */

            const tagIds = createQuestionDto.tags.filter((tag) => tag.id !== null).map((tag) => tag.id!)

            const existingTags = await tx.tag.findMany({
                where: {
                    id: {
                        in: tagIds,
                    },
                },
            })

            const existingTagIds = new Set(existingTags.map((tag) => tag.id))

            // Get tag not in tags ids
            const tagsNotExists = createQuestionDto.tags.filter((tag) => tag.id === null || !existingTagIds.has(tag.id))

            const tagNames = [...new Set(tagsNotExists.map((tag) => tag.name.trim()))]

            /**
             * create tag if not exits
             * use skipDuplicates to prevent duplicate tag
             */
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

            const tags = [...existingTags, ...newTags]

            /**
             * Create question
             * Use createMany with skipDuplicates to prevent duplicate question
             */
            const question = await tx.question.create({
                data: {
                    title: createQuestionDto.title,
                    body: createQuestionDto.body,
                    author_id: authorId,
                    tags: {
                        createMany: {
                            data: tags.map((tag) => ({
                                tag_id: tag.id,
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
                },
            })

            return question
        })
    }

    findAll() {
        return `This action returns all questions`
    }

    findOne(id: number) {
        return `This action returns a #${id} question`
    }

    update(id: number, updateQuestionDto: UpdateQuestionDto) {
        return `This action updates a #${id} question`
    }

    remove(id: number) {
        return `This action removes a #${id} question`
    }
}
