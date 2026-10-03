import { ExecutionContext, Injectable } from '@nestjs/common'

import type { IRequest } from '../../type.js'
import { AuthGuard } from './auth.guard.js'

/**
 * Cho phép request không có access token (khách) đi qua với req.decoded = undefined.
 * Nếu có gửi token thì xác thực giống AuthGuard, để client vẫn nhận lỗi hết hạn và refresh token.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<IRequest>()

        if (!req.headers.authorization) {
            return true
        }

        return super.canActivate(context)
    }
}
