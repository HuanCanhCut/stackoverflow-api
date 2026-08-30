import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { createObserveModule } from '@nestjs/observe'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor.js'
import { GlobalExceptionFilter } from './error/errorHanlder.js'

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
    ],

    controllers: [AppController],
    providers: [
        AppService,
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
