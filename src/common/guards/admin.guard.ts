import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import type { IRequest } from '../../type.js'

/**
 * Dùng sau AuthGuard: `@UseGuards(AuthGuard, AdminGuard)`.
 * JWT chỉ chứa sub nên phải đọc role từ DB, để việc hạ quyền có hiệu lực ngay.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<IRequest>()

        const user = req.decoded
            ? await this.prisma.user.findUnique({
                  where: { id: req.decoded.sub },
                  select: { role: true, is_blocked: true },
              })
            : null

        if (!user || user.role !== 'admin' || user.is_blocked) {
            throw new ForbiddenException({
                message: 'Bạn không có quyền truy cập',
                code: 'ADMIN_REQUIRED',
            })
        }

        return true
    }
}
