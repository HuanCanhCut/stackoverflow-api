import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Redis } from 'ioredis'

import type { IRequest } from '../../type.js'
import decodedToken from '../../utils/jwt.util.js'

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly redis: Redis) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<IRequest>()
        const [scheme, accessToken] = req.headers.authorization?.split(' ') ?? []

        if (scheme !== 'Bearer' || !accessToken) {
            throw new UnauthorizedException({
                message: 'Không tìm thấy access token',
                code: 'ACCESS_TOKEN_REQUIRED',
            })
        }

        const blacklistedToken = await this.redis.get(`access_token:${accessToken}`)

        if (blacklistedToken) {
            throw new UnauthorizedException({
                message: 'Access token đã bị thu hồi',
                code: 'TOKEN_REVOKED',
            })
        }

        const payload = decodedToken(accessToken)

        if (!payload) {
            throw new UnauthorizedException({
                message: 'Access token không hợp lệ',
                code: 'TOKEN_VERIFICATION_FAILED',
            })
        }

        req.decoded = payload

        return true
    }
}
