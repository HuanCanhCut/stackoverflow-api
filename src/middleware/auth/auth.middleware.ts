import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { NextFunction, Response } from 'express'
import { Redis } from 'ioredis'
import jwt from 'jsonwebtoken'

const { JsonWebTokenError, TokenExpiredError } = jwt

import type { IRequest } from '../../type.js'

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(
        private readonly redis: Redis,
        private readonly jwtService: JwtService,
    ) {}

    async use(req: IRequest, res: Response, next: NextFunction) {
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

        try {
            const decodedToken = this.jwtService.verify(accessToken, {
                secret: process.env.JWT_SECRET,
            })

            req.decoded = decodedToken
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                return res.status(401).set('x-refresh-token-required', 'true').json({
                    error: 'Xác thực thất bại do token hết hạn.',
                    code: 'TOKEN_EXPIRED',
                })
            }

            if (error instanceof JsonWebTokenError) {
                throw new UnauthorizedException({
                    message: 'Access token không hợp lệ',
                    code: 'TOKEN_VERIFICATION_FAILED',
                })
            }

            throw error
        }

        next()
    }
}
