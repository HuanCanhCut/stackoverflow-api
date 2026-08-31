import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'

import { responseData } from '../schemas/response/index.js'
import { AuthService } from './auth.service.js'
import { LoginDTO } from './dto/login.dto.js'
import { LogoutDTO } from './dto/logout.dto.js'

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
}
