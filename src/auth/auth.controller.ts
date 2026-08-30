import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { AuthService } from './auth.service.js'

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get(':id')
    async getUserById(@Param('id', ParseIntPipe) id: number) {
        return await this.authService.getUserById(id)
    }
}
