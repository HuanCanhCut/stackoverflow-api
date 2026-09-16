import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { createObserveModule } from '@nestjs/observe'
import { ScheduleModule } from '@nestjs/schedule'

import { AuthModule } from './api/auth/auth.module.js'
import { NotificationsModule } from './api/notifications/notifications.module.js'
import { QuestionsModule } from './api/questions/questions.module.js'
import { TagsModule } from './api/tags/tags.module.js'
import { UploadsModule } from './api/uploads/uploads.module.js'
import { AppController } from './app.controller.js'
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor.js'
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js'
import { PrismaModule } from './config/prisma/prisma.module.js'
import { RedisModule } from './config/redis/redis.module.js'
import { S3Module } from './config/s3/s3.module.js'
import { GlobalExceptionFilter } from './error/errorHanlder.js'
import { JwtTokenModule } from './modules/jwt/jwt.module.js'
import { MailModule } from './modules/mail/mail.module.js'
import { NodemailerModule } from './modules/nodemailer/nodemailer.module.js'
import { QuestionScoreModule } from './modules/question_score/question_score.module.js'
import { RateLimitModule } from './modules/rate_limit/rate_limit.module.js'
import { QueueModule } from './queue/queue.module.js'

export const { ObserveModule, ObserveInstrument } = createObserveModule()

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ScheduleModule.forRoot(),

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
        S3Module,
        QueueModule,
        NodemailerModule,
        RateLimitModule,
        JwtTokenModule,
        MailModule,
        QuestionScoreModule,
        QuestionsModule,
        UploadsModule,
        NotificationsModule,
        TagsModule,
    ],

    controllers: [AppController],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: HttpLoggingInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },
    ],
})
export class AppModule {}
