import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

import { PrismaService } from '../prisma.service.js'

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
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

        return { user, accessToken, refreshToken }
    }
}
