import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { createObserveModule } from '@nestjs/observe'

import { AppController } from './app.controller.js'
import { AuthModule } from './auth/auth.module.js'
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor.js'
import { PrismaModule } from './config/prisma/prisma.module.js'
import { RedisModule } from './config/redis/redis.module.js'
import { GlobalExceptionFilter } from './error/errorHanlder.js'
import { MailModule } from './modules/mail/mail.module.js'
import { NodemailerModule } from './modules/nodemailer/nodemailer.module.js'
import { QueueModule } from './queue/queue.module.js'

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
                forwardLogs: config.get<string>('OBSERVE_ENABLED', 'true') === 'true',
            }),
        }),

        AuthModule,
        RedisModule,
        PrismaModule,
        QueueModule,
        NodemailerModule,
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
        MailModule,
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
