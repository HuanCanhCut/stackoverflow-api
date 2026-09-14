import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

@Injectable()
export class QuestionsService {
    constructor(private readonly prisma: PrismaService) {}

    private async resolveTags(tx: TransactionClient, inputTags: CreateQuestionDto['tags']) {
        const tagIds = inputTags.filter((tag) => tag.id !== null).map((tag) => tag.id!)

        const existingTags = await tx.tag.findMany({
            where: {
                id: {
                    in: tagIds,
                },
            },
        })

        const existingTagIds = new Set(existingTags.map((tag) => tag.id))

        const tagsNotExists = inputTags.filter((tag) => tag.id === null || !existingTagIds.has(tag.id))

        const tagNames = [...new Set(tagsNotExists.map((tag) => tag.name.trim()))]

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

        return [...existingTags, ...newTags]
    }

    async create(createQuestionDto: CreateQuestionDto, authorId: number) {
        return this.prisma.$transaction(async (tx) => {
            const tags = await this.resolveTags(tx, createQuestionDto.tags)

            return tx.question.create({
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
        })
    }

    findAll() {
        return `This action returns all questions`
    }

    findOne(id: number) {
        return `This action returns a #${id} question`
    }

    async update({
        id,
        updateQuestionDto,
        currentUserId,
    }: {
        id: number
        updateQuestionDto: UpdateQuestionDto
        currentUserId: number
    }) {
        return this.prisma.$transaction(async (tx) => {
            const question = await tx.question.findUnique({
                where: {
                    id,
                },
            })

            if (!question) {
                throw new NotFoundException('Question not found')
            }

            if (question.author_id !== currentUserId) {
                throw new BadRequestException('You are not the author of this question')
            }

            const tags = updateQuestionDto.tags ? await this.resolveTags(tx, updateQuestionDto.tags) : undefined

            return tx.question.update({
                where: {
                    id,
                },
                data: {
                    title: updateQuestionDto.title,
                    body: updateQuestionDto.body,

                    ...(tags !== undefined && {
                        tags: {
                            deleteMany: {},
                            createMany: {
                                data: tags.map((tag) => ({
                                    tag_id: tag.id,
                                })),
                                skipDuplicates: true,
                            },
                        },
                    }),
                },
                include: {
                    tags: {
                        include: {
                            tag: true,
                        },
                    },
                },
            })
        })
    }

    async remove({ id, currentUserId }: { id: number; currentUserId: number }) {
        const question = await this.prisma.question.findUnique({
            where: {
                id,
            },
        })

        if (question?.author_id !== currentUserId) {
            throw new ForbiddenException('You are not the author of this question')
        }

        await this.prisma.question.delete({
            where: {
                id,
            },
        })

        return
    }
}
