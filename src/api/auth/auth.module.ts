import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { MailModule } from '../../modules/mail/mail.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

@Module({
    imports: [JwtModule, MailModule],
    controllers: [AuthController],
    providers: [AuthService, AuthGuard],
})
export class AuthModule {}
