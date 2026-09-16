import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { seconds, Throttle } from '@nestjs/throttler'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { ResponsePagination } from '../../common/response/response.decorators.js'
import type { IRequest } from '../../type.js'
import { AuthService } from './auth.service.js'
import { ResetPasswordDTO, SendForgotPasswordCodeDTO } from './dto/forgot_password.dto.js'
import { GetCurrentUserQuestionsDto } from './dto/get-current-user-questions.dto.js'
import { LoginDTO } from './dto/login.dto.js'
import { loginWithTokenDTO } from './dto/login_with_token.dto.js'
import { LogoutDTO } from './dto/logout.dto.js'
import { RefreshTokenDTO } from './dto/refresh_token.dto.js'
import { RegisterDTO } from './dto/register.dto.js'
import { UpdateCurrentUserDto } from './dto/update-current-user.dto.js'

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() body: LoginDTO) {
        const { user, accessToken, refreshToken } = await this.authService.login({
            email: body.email,
            password: body.password,
        })

        return {
            data: user,
            meta: {
                access_token: accessToken,
                refresh_token: refreshToken,
            },
        }
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    async logout(@Body() body: LogoutDTO) {
        await this.authService.logout({ access_token: body.access_token, refresh_token: body.refresh_token })
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(@Body() body: RefreshTokenDTO) {
        const { accessToken, refreshToken } = await this.authService.refreshToken({ refresh_token: body.refresh_token })

        return {
            data: null,
            meta: {
                access_token: accessToken,
                refresh_token: refreshToken,
            },
        }
    }

    @Post('register')
    async register(@Body() body: RegisterDTO) {
        const { user, accessToken, refreshToken } = await this.authService.register({
            email: body.email,
            password: body.password,
            full_name: body.full_name,
        })

        return {
            data: user,
            meta: {
                access_token: accessToken,
                refresh_token: refreshToken,
            },
        }
    }

    @Get('me')
    @UseGuards(AuthGuard)
    async getCurrentUser(@Req() req: IRequest) {
        const user = await this.authService.getCurrentUser(req.decoded.sub)

        return user
    }

    @Get('me/questions')
    @ResponsePagination()
    getCurrentUserQuestions(@Query() query: GetCurrentUserQuestionsDto, @Req() req: IRequest) {
        return this.authService.getCurrentUserQuestions(req.decoded.sub, query)
    }

    @Get('me/answered-questions')
    @ResponsePagination()
    getCurrentUserAnsweredQuestions(@Query() query: GetCurrentUserQuestionsDto, @Req() req: IRequest) {
        return this.authService.getCurrentUserAnsweredQuestions(req.decoded.sub, query)
    }

    @Patch('me')
    @UseGuards(AuthGuard)
    updateCurrentUser(@Body() body: UpdateCurrentUserDto, @Req() req: IRequest) {
        return this.authService.updateCurrentUser(req.decoded.sub, body)
    }

    @Post('login-with-token')
    async loginWithToken(@Body() body: loginWithTokenDTO) {
        const { token } = body

        const { accessToken, refreshToken, user } = await this.authService.loginWithToken(token)

        return {
            data: user,
            meta: {
                access_token: accessToken,
                refresh_token: refreshToken,
            },
        }
    }

    @Throttle({
        default: {
            limit: 10, // 1 ip 10 req/minute, limit email 1 req/minute in service
            ttl: seconds(60),
        },
    })
    @Post('forgot-password/code')
    @HttpCode(HttpStatus.NO_CONTENT)
    async sendForgotPasswordCode(@Body() body: SendForgotPasswordCodeDTO) {
        const { email } = body

        await this.authService.sendForgotPasswordCode({ email })
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.NO_CONTENT)
    async resetPassword(@Body() body: ResetPasswordDTO) {
        const { email, code, password } = body

        await this.authService.resetPassword({ email, code, password })
    }
}
