import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { Redis } from 'ioredis'

import { PrismaService } from '../config/prisma/prisma.service.js'
import { JwtPayload } from '../type.js'

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly redis: Redis,
    ) {}

    async login({ email, password }: { email: string; password: string }) {
        const user = await this.prisma.user.findUnique({
            where: {
                email,
            },
            omit: {
                password: false,
            },
        })

        if (!user) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác')
        }

        // check user password
        const passwordIsValid = await bcrypt.compare(password, user.password)

        if (!passwordIsValid) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác')
        }

        // Generate JWT tokens
        const payload = {
            sub: user.id,
            jti: randomUUID(),
        }

        const accessToken = this.jwtService.sign(payload, { expiresIn: '30m' })
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' })

        const { password: _, ...safeUser } = user

        return { user: safeUser, accessToken, refreshToken }
    }

    async logout({ access_token, refresh_token }: { access_token?: string; refresh_token?: string }) {
        let decodedRefreshToken: JwtPayload | null = null

        try {
            if (refresh_token) {
                decodedRefreshToken = this.jwtService.decode(refresh_token)
            }
        } catch (_) {
            //
        }

        if (decodedRefreshToken) {
            await this.prisma.refreshToken.delete({
                where: {
                    jti: decodedRefreshToken?.jti,
                },
            })
        }

        if (access_token) {
            await this.redis.set(`access_token:${access_token}`, 'true', 'EX', '30m')
        }
    }
}
