import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { getAuth } from 'firebase-admin/auth'
import { Redis } from 'ioredis'
import type { StringValue } from 'ms'

import { PrismaService } from '../../config/prisma/prisma.service.js'
import { MailProducer } from '../../modules/mail/mail.producer.js'
import { JwtPayload } from '../../type.js'
import type { GetCurrentUserQuestionsDto } from './dto/get-current-user-questions.dto.js'
import type { UpdateCurrentUserDto } from './dto/update-current-user.dto.js'

import type { Prisma } from '~/generated/prisma/client.js'

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly redis: Redis,
        private readonly mailProducer: MailProducer,
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

        if (!user || !user.password) {
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
            decoded = this.jwtService.verify<JwtPayload>(refresh_token, {
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

    async register({ email, password, full_name }: { email: string; password: string; full_name: string }) {
        const SALT_ROUND = 10
        const passwordHashed = await bcrypt.hash(password, SALT_ROUND)

        const splitName = full_name.trim().split(' ')

        const firstName = splitName.length === 1 ? '' : splitName.slice(0, splitName.length - 1).join(' ')
        const lastName = splitName.slice(splitName.length - 1).join(' ')

        const isExitsEmail = await this.prisma.user.findUnique({
            where: {
                email,
            },
        })

        if (isExitsEmail) {
            throw new ConflictException('Tài khoản đã tồn tại')
        }

        const user = await this.prisma.user.create({
            data: {
                email,
                password: passwordHashed,
                first_name: firstName,
                last_name: lastName,
                is_active: false,
                sign_in_provider: 'email',
                nickname: randomUUID(),
            },
        })

        const accessToken = this.jwtService.sign(
            {
                sub: user.id,
                jti: randomUUID(),
            },
            {
                secret: process.env.JWT_SECRET,
                expiresIn: process.env.ACCESS_TOKEN_EXP as StringValue,
            },
        )

        const refreshToken = this.jwtService.sign(
            {
                sub: user.id,
                jti: randomUUID(),
            },
            {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: process.env.REFRESH_TOKEN_EXP as StringValue,
            },
        )

        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                jti: randomUUID(),
                user_id: user.id,
            },
        })

        return { user, accessToken, refreshToken }
    }

    async getCurrentUser(currentUserId: number) {
        const [user, questionCount, voteAggregation, answeredQuestions] = await this.prisma.$transaction([
            this.prisma.user.findUnique({
                where: {
                    id: currentUserId,
                },
                omit: {
                    email: false,
                },
            }),
            this.prisma.question.count({
                where: {
                    author_id: currentUserId,
                    parent_id: null,
                },
            }),
            this.prisma.question.aggregate({
                where: {
                    author_id: currentUserId,
                },
                _sum: {
                    vote_count: true,
                },
            }),
            this.prisma.question.groupBy({
                by: ['parent_id'],
                where: {
                    author_id: currentUserId,
                    parent_id: {
                        not: null,
                    },
                },
            }),
        ])

        if (!user) {
            throw new UnauthorizedException('Tài khoản không tồn tại')
        }

        return {
            ...user,
            question_count: questionCount,
            vote_count: voteAggregation._sum.vote_count ?? 0,
            answered_question_count: answeredQuestions.length,
        }
    }

    async updateCurrentUser(currentUserId: number, body: UpdateCurrentUserDto) {
        const currentUser = await this.prisma.user.findUnique({
            where: {
                id: currentUserId,
            },
            select: {
                id: true,
                nickname: true,
            },
        })

        if (!currentUser) {
            throw new UnauthorizedException('Tài khoản không tồn tại')
        }

        if (body.nickname !== undefined && body.nickname !== currentUser.nickname) {
            const nicknameOwner = await this.prisma.user.findUnique({
                where: {
                    nickname: body.nickname,
                },
                select: {
                    id: true,
                },
            })

            if (nicknameOwner) {
                throw new ConflictException('Nickname đã được sử dụng')
            }
        }

        return this.prisma.user.update({
            where: {
                id: currentUserId,
            },
            data: body,
            omit: {
                email: false,
            },
        })
    }

    async getCurrentUserQuestions(currentUserId: number, query: GetCurrentUserQuestionsDto) {
        return this.getPaginatedQuestions({
            ...query,
            where: {
                author_id: currentUserId,
                parent_id: null,
            },
        })
    }

    async getCurrentUserAnsweredQuestions(currentUserId: number, query: GetCurrentUserQuestionsDto) {
        return this.getPaginatedQuestions({
            ...query,
            where: {
                parent_id: null,
                replies: {
                    some: {
                        author_id: currentUserId,
                    },
                },
            },
        })
    }

    private async getPaginatedQuestions({
        where,
        page,
        per_page,
    }: GetCurrentUserQuestionsDto & {
        where: Prisma.QuestionWhereInput
    }) {
        const [questions, total] = await this.prisma.$transaction([
            this.prisma.question.findMany({
                where,
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                include: {
                    author: true,
                    tags: {
                        include: {
                            tag: true,
                        },
                    },
                    attachments: true,
                    post_score: true,
                    _count: {
                        select: {
                            replies: true,
                        },
                    },
                },
            }),
            this.prisma.question.count({ where }),
        ])

        const data = questions.map(({ _count, ...question }) => ({
            ...question,
            reply_count: _count.replies,
        }))

        return {
            data,
            total,
            count: data.length,
            current_page: page,
            per_page,
        }
    }

    async loginWithToken(token: string) {
        const decodedToken = await getAuth().verifyIdToken(token)

        const {
            firebase: { sign_in_provider },
        } = decodedToken

        const {
            photoURL,
            displayName,
            uid,
            providerData: [{ email }],
        } = await getAuth().getUser(decodedToken.uid)

        let hasUser = await this.prisma.user.findUnique({
            where: {
                provider_uid: uid,
            },
        })

        /**
         * Handle link account if account with same email is already exists but is not linked with firebase
         */

        if (email) {
            const hasUserWithEmail = await this.prisma.user.findFirst({
                where: {
                    email,
                    provider_uid: null,
                    sign_in_provider: 'email',
                },
            })

            if (hasUserWithEmail) {
                await this.prisma.user.update({
                    where: {
                        id: hasUserWithEmail.id,
                    },
                    data: {
                        provider_uid: uid,
                    },
                })

                hasUser = hasUserWithEmail
            }
        }

        /**
         * Get first name and last name from display name
         */
        const splitName = displayName?.split(' ')

        let firstName = ''
        let lastName = ''

        if (splitName && displayName) {
            if (splitName.length >= 2) {
                const middleIndex = Math.floor(splitName.length / 2)

                firstName = splitName.slice(0, middleIndex).join(' ')
                lastName = splitName.slice(middleIndex).join(' ')
            } else {
                lastName = displayName
            }
        }

        /**
         * Create user if not exists
         */

        if (!hasUser) {
            hasUser = await this.prisma.user.create({
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    nickname: randomUUID(),
                    avatar_path: photoURL,
                    sign_in_provider: sign_in_provider as 'google' | 'github' | 'email',
                    provider_uid: uid,
                    password: null,
                },
            })
        }

        /**
         * Generate token
         */
        const accessToken = this.jwtService.sign(
            {
                sub: hasUser.id,
                jti: randomUUID(),
            },
            {
                secret: process.env.JWT_SECRET,
                expiresIn: process.env.ACCESS_TOKEN_EXP as StringValue,
            },
        )

        const refreshToken = this.jwtService.sign(
            {
                sub: hasUser.id,
                jti: randomUUID(),
            },
            {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: process.env.REFRESH_TOKEN_EXP as StringValue,
            },
        )

        return { accessToken: accessToken, refreshToken, user: hasUser }
    }

    async sendForgotPasswordCode({ email }: { email: string }) {
        const normalizedEmail = email.trim().toLowerCase()

        const key = `forgot-password:cooldown:${normalizedEmail}`

        const created = await this.redis.set(key, '1', 'EX', 60, 'NX')

        if (!created) {
            const ttl = await this.redis.ttl(key)

            throw new HttpException(
                {
                    code: 'FORGOT_PASSWORD_CODE_COOLDOWN',
                    message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${ttl} giây`,
                    retry_after: ttl,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }

        /**
         * Don't check user exist avoid hacker can know user is exist in database or not
         */

        await this.mailProducer.sendForgotPasswordCode(email)
    }

    async resetPassword({ email, password, code }: { email: string; password: string; code: number }) {
        const isValidCode = await this.redis.get(`reset_password_code:${code}`)

        if (!isValidCode) {
            throw new BadRequestException('Mã xác thực không đúng')
        }

        const decodedResetCode: { email: string; created_at: string } = JSON.parse(isValidCode)

        if (decodedResetCode.email !== email) {
            throw new BadRequestException('Mã xác thực không đúng')
        }

        const SALT_ROUND = 10

        const passwordHashed = await bcrypt.hash(password, SALT_ROUND)

        /**
         * Update user
         */
        await this.prisma.user.update({
            where: {
                email,
            },
            data: {
                password: passwordHashed,
            },
        })

        /**
         * Clear reset password code
         */
        await this.redis.del(`reset_password_code:${code}`)
    }
}
