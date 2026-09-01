import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { Redis } from 'ioredis'
import type { StringValue } from 'ms'

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

        const accessToken = this.jwtService.sign(payload, {
            expiresIn: process.env.ACCESS_TOKEN_EXP as StringValue,
            secret: process.env.JWT_SECRET,
        })
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: process.env.REFRESH_TOKEN_EXP as StringValue,
            secret: process.env.JWT_REFRESH_SECRET,
        })

        const { password: _, ...safeUser } = user

        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                jti: payload.jti,
                user_id: user.id,
            },
        })

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

    async refreshToken({ refresh_token }: { refresh_token: string }) {
        let decoded: JwtPayload | null = null

        try {
            decoded = this.jwtService.verify(refresh_token, {
                secret: process.env.JWT_REFRESH_SECRET,
            })
        } catch (error: any) {
            if (error.message === 'jwt expired') {
                await this.prisma.refreshToken.delete({
                    where: {
                        token: refresh_token,
                    },
                })

                throw new UnauthorizedException('Refresh token đã hết hạn')
            }

            throw new BadRequestException(error.message)
        }

        if (!decoded) {
            throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn')
        }

        const hasRefreshToken = await this.prisma.refreshToken.findUnique({
            where: {
                token: refresh_token,
            },
        })

        if (!hasRefreshToken) {
            throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn')
        }

        const payload = { sub: decoded.sub }

        if (!decoded.exp) {
            throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn')
        }

        // Giữ giá trị exp token cũ gắn vào token mới
        const exp = Math.floor((decoded.exp * 1000 - Date.now()) / 1000)

        const newAccessToken = this.jwtService.sign(payload, {
            expiresIn: process.env.ACCESS_TOKEN_EXP as StringValue,
            secret: process.env.JWT_SECRET,
        })
        const newRefreshToken = this.jwtService.sign(payload, {
            expiresIn: exp,
            secret: process.env.JWT_REFRESH_SECRET,
        })

        await this.prisma.refreshToken.update({
            where: {
                token: refresh_token,
            },
            data: {
                token: newRefreshToken,
            },
        })

        return { accessToken: newAccessToken, refreshToken: newRefreshToken }
    }
}
