import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { RedisModule } from '../config/redis/redis.module.js'
import { AuthMiddleware } from '../middleware/auth/auth.middleware.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

@Module({
    imports: [RedisModule, JwtModule],
    controllers: [AuthController],
    providers: [AuthService, AuthMiddleware],
})
export class AuthModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(AuthMiddleware).forRoutes('auth/me')
    }
}
