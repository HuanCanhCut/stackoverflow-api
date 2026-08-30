import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { createObserveModule } from '@nestjs/observe'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor.js'
import { GlobalExceptionFilter } from './error/errorHanlder.js'
import { AuthModule } from './auth/auth.module.js'
import { redisProvider } from './config/redis/redis.client.js'
import { RedisModule } from './config/redis/redis.module.js'
import { JwtModule } from '@nestjs/jwt'
import { PrismaModule } from './prisma.module.js'

export const { ObserveModule, ObserveInstrument } = createObserveModule()

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),

        ObserveModule.forRootAsync({
            inject: [ConfigService],

            useFactory: (config: ConfigService) => ({
                appKey: config.getOrThrow<string>('OBSERVE_APP_KEY'),
                appSecret: config.getOrThrow<string>('OBSERVE_APP_SECRET'),

                serviceId: 'stackoverflow-api',
            }),
        }),

        AuthModule,
        RedisModule,
        PrismaModule,
        JwtModule.registerAsync({
            global: true,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.getOrThrow<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: '60s',
                },
            }),
        }),
    ],

    controllers: [AppController],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: HttpLoggingInterceptor,
        },
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },
    ],
})
export class AppModule {}
