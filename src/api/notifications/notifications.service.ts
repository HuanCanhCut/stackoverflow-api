import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import type { CreateNotificationDto } from './dto/create-notification.dto.js'

import type { Prisma } from '~/generated/prisma/client.js'

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    async create({
        content,
        metadata,
        recipient_ids,
        actorId,
    }: CreateNotificationDto & {
        actorId: number
    }) {
        const recipientIds = [...new Set(recipient_ids)]
        const recipientCount = await this.prisma.user.count({
            where: {
                id: {
                    in: recipientIds,
                },
            },
        })

        if (recipientCount !== recipientIds.length) {
            throw new BadRequestException('One or more notification recipients do not exist')
        }

        return this.prisma.notification.create({
            data: {
                content,
                actor_id: actorId,
                ...(metadata !== null && metadata !== undefined && {
                    metadata: metadata as Prisma.InputJsonObject,
                }),
                recipients: {
                    createMany: {
                        data: recipientIds.map((recipientId) => ({
                            recipient_id: recipientId,
                        })),
                    },
                },
            },
            include: {
                actor: true,
                recipients: true,
            },
        })
    }

    async findAll({
        page,
        per_page,
        currentUserId,
    }: {
        page: number
        per_page: number
        currentUserId: number
    }) {
        const [notifications, total, unseenCount] = await this.prisma.$transaction([
            this.prisma.notification.findMany({
                where: {
                    recipients: {
                        some: {
                            recipient_id: currentUserId,
                        },
                    },
                },
                include: {
                    actor: true,
                    recipients: {
                        where: {
                            recipient_id: currentUserId,
                        },
                        omit: {
                            seen_at: true,
                            read_at: true,
                        },
                    },
                },
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: {
                    id: 'desc',
                },
            }),
            this.prisma.notification.count({
                where: {
                    recipients: {
                        some: {
                            recipient_id: currentUserId,
                        },
                    },
                },
            }),
            this.prisma.notificationRecipient.count({
                where: {
                    recipient_id: currentUserId,
                    is_seen: false,
                },
            }),
        ])

        const data = notifications.map(({ recipients: [recipient], ...notification }) => ({
            ...notification,
            recipient,
        }))

        return {
            data,
            total,
            count: data.length,
            current_page: page,
            per_page,
            unseen_count: unseenCount,
        }
    }

    async markAllAsSeen(currentUserId: number) {
        await this.prisma.notificationRecipient.updateMany({
            where: {
                recipient_id: currentUserId,
                is_seen: false,
            },
            data: {
                is_seen: true,
                seen_at: new Date(),
            },
        })
    }

    async markAsRead({ id, currentUserId }: { id: string; currentUserId: number }) {
        const result = await this.prisma.notificationRecipient.updateMany({
            where: {
                notification_id: id,
                recipient_id: currentUserId,
            },
            data: {
                is_read: true,
                read_at: new Date(),
            },
        })

        if (result.count === 0) {
            throw new NotFoundException('Notification not found')
        }
    }

    async remove({ id, currentUserId }: { id: string; currentUserId: number }) {
        const result = await this.prisma.notification.deleteMany({
            where: {
                id,
                actor_id: currentUserId,
            },
        })

        if (result.count === 0) {
            throw new NotFoundException('Notification not found')
        }
    }

}
