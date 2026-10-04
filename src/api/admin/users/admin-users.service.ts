import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Redis } from 'ioredis'

import { PrismaService } from '../../../config/prisma/prisma.service.js'
import { blockedUserKey } from '../../../utils/blocked-user.util.js'
import { toPagination } from '../dto/admin-pagination.dto.js'
import { AdminUserSort, AdminUserStatus, type GetAdminUsersDto, type UpdateUserRoleDto } from './admin-users.dto.js'

import type { Prisma } from '~/generated/prisma/client.js'

// Admin được xem các field mà client thường bị ẩn
const adminUserOmit = {
    email: false,
    sign_in_provider: false,
} as const

const blockedBySelect = {
    select: { id: true, nickname: true, first_name: true, last_name: true },
} as const

@Injectable()
export class AdminUsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: Redis,
    ) {}

    async findAll(query: GetAdminUsersDto) {
        const { search, role, status, sort, page, per_page } = query

        const where: Prisma.UserWhereInput = {
            ...(role && { role }),
            ...(status && { is_blocked: status === AdminUserStatus.Blocked }),
            ...(search && {
                OR: [
                    { email: { contains: search } },
                    { nickname: { contains: search } },
                    { first_name: { contains: search } },
                    { last_name: { contains: search } },
                    ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
                ],
            }),
        }

        const direction = sort === AdminUserSort.Oldest ? 'asc' : 'desc'

        const [users, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [{ created_at: direction }, { id: direction }],
                omit: adminUserOmit,
                include: {
                    _count: { select: { questions: true } },
                },
            }),
            this.prisma.user.count({ where }),
        ])

        const data = users.map(({ _count, ...user }) => ({ ...user, post_count: _count.questions }))

        return toPagination(data, total, query)
    }

    async findOne(id: number) {
        const [user, questionCount, answerCount, rejectedCount, voteAggregation] = await this.prisma.$transaction([
            this.prisma.user.findUnique({
                where: { id },
                omit: adminUserOmit,
                include: { blocked_by_user: blockedBySelect },
            }),
            this.prisma.question.count({ where: { author_id: id, parent_id: null } }),
            this.prisma.question.count({ where: { author_id: id, parent_id: { not: null } } }),
            this.prisma.question.count({ where: { author_id: id, moderation_status: 'rejected' } }),
            this.prisma.question.aggregate({ where: { author_id: id }, _sum: { vote_count: true } }),
        ])

        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại')
        }

        return {
            ...user,
            question_count: questionCount,
            answer_count: answerCount,
            rejected_count: rejectedCount,
            vote_count: voteAggregation._sum.vote_count ?? 0,
        }
    }

    async block(id: number, reason: string, adminId: number) {
        const target = await this.getTargetUser(id, adminId)

        if (target.role === 'admin') {
            throw new ForbiddenException('Không thể khóa tài khoản admin, hãy hạ quyền trước')
        }

        // Thu hồi mọi refresh token để user không thể lấy access token mới
        const [user] = await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id },
                data: {
                    is_blocked: true,
                    blocked_at: new Date(),
                    blocked_reason: reason,
                    blocked_by: adminId,
                },
                omit: adminUserOmit,
                include: { blocked_by_user: blockedBySelect },
            }),
            this.prisma.refreshToken.deleteMany({ where: { user_id: id } }),
        ])

        // Access token còn hạn bị AuthGuard chặn qua key này
        await this.redis.set(blockedUserKey(id), '1')

        return user
    }

    async unblock(id: number, adminId: number) {
        await this.getTargetUser(id, adminId)

        const user = await this.prisma.user.update({
            where: { id },
            data: {
                is_blocked: false,
                blocked_at: null,
                blocked_reason: null,
                blocked_by: null,
            },
            omit: adminUserOmit,
        })

        await this.redis.del(blockedUserKey(id))

        return user
    }

    async updateRole(id: number, { role }: UpdateUserRoleDto, adminId: number) {
        await this.getTargetUser(id, adminId)

        return this.prisma.user.update({
            where: { id },
            data: { role },
            omit: adminUserOmit,
        })
    }

    /** Admin không được tự khóa / đổi quyền chính mình để tránh mất quyền quản trị */
    private async getTargetUser(id: number, adminId: number) {
        if (id === adminId) {
            throw new BadRequestException('Không thể thực hiện thao tác này trên chính tài khoản của bạn')
        }

        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        })

        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại')
        }

        return user
    }
}
