import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common'
import type { NextFunction, Response } from 'express'
import { Redis } from 'ioredis'

import type { IRequest } from '../../type.js'
import decodedToken from '../../utils/jwt.util.js'

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(private readonly redis: Redis) {}

    async use(req: IRequest, _res: Response, next: NextFunction) {
        const accessToken = req.headers.authorization?.split(' ')[1]

        if (!accessToken) {
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

        next()
    }
}
