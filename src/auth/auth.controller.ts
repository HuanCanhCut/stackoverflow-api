import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'

import { responseData } from '../schemas/response/index.js'
import type { IRequest } from '../type.js'
import { AuthService } from './auth.service.js'
import { LoginDTO } from './dto/login.dto.js'
import { LogoutDTO } from './dto/logout.dto.js'
import { RefreshTokenDTO } from './dto/refresh_token.dto.js'
import { RegisterDTO } from './dto/register.dto.js'

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() body: LoginDTO) {
        const { user, accessToken, refreshToken } = await this.authService.login({
            email: body.email,
            password: body.password,
        })

        return responseData(user, {
            access_token: accessToken,
            refresh_token: refreshToken,
        })
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

        return responseData(null, {
            access_token: accessToken,
            refresh_token: refreshToken,
        })
    }

    @Post('register')
    async register(@Body() body: RegisterDTO) {
        const { user, accessToken, refreshToken } = await this.authService.register({
            email: body.email,
            password: body.password,
            full_name: body.full_name,
        })

        return responseData(user, {
            access_token: accessToken,
            refresh_token: refreshToken,
        })
    }

    @Get('me')
    async getCurrentUser(@Req() req: IRequest) {
        const user = await this.authService.getCurrentUser(req.decoded.sub)

        return responseData(user)
    }
}
