import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import { SocketEvent } from '../../modules/socket/socket.enum.js'
import { SocketGateway } from '../../modules/socket/socket.gateway.js'
import { UploadsService } from '../uploads/uploads.service.js'
import type { GetConversationsDto } from './dto/get-conversations.dto.js'
import type { GetMessagesDto } from './dto/get-messages.dto.js'
import type { SendMessageDto } from './dto/send-message.dto.js'

import { S3Folder } from '~/types/s3.type.js'

const messageInclude = {
    attachments: true,
} as const

// Lấy kèm thông tin 2 người tham gia và tin nhắn mới nhất để hiển thị trong danh sách hội thoại
const conversationInclude = {
    user_one: true,
    user_two: true,
    messages: {
        take: 1,
        orderBy: { id: 'desc' as const },
        include: messageInclude,
    },
}

// Hội thoại 1-1 lưu cặp user theo thứ tự id tăng dần (xem prisma/conversations.prisma)
const toUserPair = (a: number, b: number) => (a < b ? [a, b] : [b, a])

@Injectable()
export class ConversationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly uploadsService: UploadsService,
        private readonly socketGateway: SocketGateway,
    ) {}

    /** Mở hội thoại với một user: đã có thì trả về hội thoại cũ, chưa có thì tạo mới */
    async findOrCreate({ userId, currentUserId }: { userId: number; currentUserId: number }) {
        if (userId === currentUserId) {
            throw new BadRequestException({ message: 'Không thể nhắn tin với chính mình' })
        }

        const partner = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })

        if (!partner) {
            throw new NotFoundException({ message: 'Người dùng không tồn tại' })
        }

        const [userOneId, userTwoId] = toUserPair(userId, currentUserId)

        // upsert dựa trên unique (user_one_id, user_two_id) nên 2 người bấm "Nhắn tin" cùng lúc vẫn chỉ có 1 hội thoại
        const conversation = await this.prisma.conversation.upsert({
            where: { user_one_id_user_two_id: { user_one_id: userOneId, user_two_id: userTwoId } },
            create: { user_one_id: userOneId, user_two_id: userTwoId },
            update: {},
            include: conversationInclude,
        })

        const [unreadCount] = await this.countUnread([conversation.id], currentUserId)

        return this.toConversationResponse(conversation, currentUserId, unreadCount)
    }

    async findAll({ page, per_page, currentUserId }: GetConversationsDto & { currentUserId: number }) {
        // Chỉ hiện hội thoại đã có tin nhắn, hội thoại vừa tạo mà chưa nhắn gì thì ẩn đi
        const where = {
            OR: [{ user_one_id: currentUserId }, { user_two_id: currentUserId }],
            last_message_at: { not: null },
        }

        const [conversations, total] = await this.prisma.$transaction([
            this.prisma.conversation.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [{ last_message_at: 'desc' }, { id: 'desc' }],
                include: conversationInclude,
            }),
            this.prisma.conversation.count({ where }),
        ])

        const unreadCounts = await this.countUnread(
            conversations.map((conversation) => conversation.id),
            currentUserId,
        )

        const data = conversations.map((conversation, index) =>
            this.toConversationResponse(conversation, currentUserId, unreadCounts[index]),
        )

        return {
            data,
            total,
            count: data.length,
            current_page: page,
            per_page,
        }
    }

    async findOne({ id, currentUserId }: { id: number; currentUserId: number }) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id },
            include: conversationInclude,
        })

        if (!conversation || !this.isMember(conversation, currentUserId)) {
            throw new NotFoundException({ message: 'Hội thoại không tồn tại' })
        }

        const [unreadCount] = await this.countUnread([conversation.id], currentUserId)

        return this.toConversationResponse(conversation, currentUserId, unreadCount)
    }

    /** Lấy tin nhắn từ mới tới cũ theo cursor (id tin nhắn), phù hợp với danh sách chat cuộn ngược lên */
    async findMessages({ id, cursor, limit, currentUserId }: GetMessagesDto & { id: number; currentUserId: number }) {
        await this.ensureMember(id, currentUserId)

        // Lấy dư 1 bản ghi để biết còn tin nhắn cũ hơn hay không
        const messages = await this.prisma.message.findMany({
            where: {
                conversation_id: id,
                ...(cursor !== undefined && { id: { lt: cursor } }),
            },
            orderBy: { id: 'desc' },
            take: limit + 1,
            include: messageInclude,
        })

        const hasMore = messages.length > limit
        const data = hasMore ? messages.slice(0, limit) : messages

        return {
            data,
            limit,
            next_cursor: hasMore ? String(data[data.length - 1].id) : null,
        }
    }

    async sendMessage({
        id,
        content,
        upload_ids,
        currentUserId,
    }: SendMessageDto & {
        id: number
        currentUserId: number
    }) {
        if (!content && upload_ids.length === 0) {
            throw new BadRequestException({ message: 'Tin nhắn phải có nội dung hoặc ảnh' })
        }

        const conversation = await this.ensureMember(id, currentUserId)

        const objectKeys = await this.uploadsService.verifyUploadIds({
            uploadIds: upload_ids,
            currentUserId,
            folder: S3Folder.MESSAGES,
        })

        const message = await this.prisma.$transaction(async (tx) => {
            const created = await tx.message.create({
                data: {
                    conversation_id: id,
                    sender_id: currentUserId,
                    content,
                    attachments: {
                        createMany: {
                            data: objectKeys.map((key) => ({ object_key: key })),
                        },
                    },
                },
                // Kèm người gửi để client hiển thị thông báo "X đã nhắn tin" khi nhận qua socket
                include: { ...messageInclude, sender: true },
            })

            await tx.conversation.update({
                where: { id },
                data: { last_message_at: created.created_at },
            })

            return created
        })

        // Gửi tới room của cả 2 người: người nhận thấy tin mới, các thiết bị khác của người gửi cũng đồng bộ
        for (const userId of [conversation.user_one_id, conversation.user_two_id]) {
            this.socketGateway.emitToUser(userId, SocketEvent.MESSAGE_CREATED, message)
        }

        return message
    }

    /** Đánh dấu đã đọc mọi tin nhắn người kia gửi trong hội thoại */
    async markAsRead({ id, currentUserId }: { id: number; currentUserId: number }) {
        await this.ensureMember(id, currentUserId)

        await this.prisma.message.updateMany({
            where: {
                conversation_id: id,
                sender_id: { not: currentUserId },
                read_at: null,
            },
            data: { read_at: new Date() },
        })
    }

    private isMember(conversation: { user_one_id: number; user_two_id: number }, userId: number) {
        return conversation.user_one_id === userId || conversation.user_two_id === userId
    }

    private async ensureMember(id: number, currentUserId: number) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id },
            select: { id: true, user_one_id: true, user_two_id: true },
        })

        // Không phải thành viên thì báo không tồn tại, tránh lộ id hội thoại của người khác
        if (!conversation || !this.isMember(conversation, currentUserId)) {
            throw new NotFoundException({ message: 'Hội thoại không tồn tại' })
        }

        return conversation
    }

    /** Số tin nhắn chưa đọc (do người kia gửi) của từng hội thoại, trả về theo đúng thứ tự ids */
    private async countUnread(conversationIds: number[], currentUserId: number) {
        if (conversationIds.length === 0) return []

        const groups = await this.prisma.message.groupBy({
            by: ['conversation_id'],
            where: {
                conversation_id: { in: conversationIds },
                sender_id: { not: currentUserId },
                read_at: null,
            },
            _count: { _all: true },
        })

        const countById = new Map(groups.map((group) => [group.conversation_id, group._count._all]))

        return conversationIds.map((id) => countById.get(id) ?? 0)
    }

    // Trả về "partner" (người còn lại) thay vì user_one / user_two để client không phải tự so id
    private toConversationResponse<
        T extends {
            user_one_id: number
            user_one: unknown
            user_two: unknown
            messages: unknown[]
        },
    >(conversation: T, currentUserId: number, unreadCount: number) {
        const { user_one, user_two, messages, ...rest } = conversation

        return {
            ...rest,
            partner: conversation.user_one_id === currentUserId ? user_two : user_one,
            last_message: messages[0] ?? null,
            unread_count: unreadCount,
        }
    }
}
