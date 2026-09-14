import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'

import { UploadsController } from './uploads.controller.js'
import { UploadsService } from './uploads.service.js'

import { AuthMiddleware } from '~/middleware/auth/auth.middleware.js'

@Module({
    controllers: [UploadsController],
    providers: [UploadsService],
})
export class UploadsModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(AuthMiddleware).forRoutes(UploadsController)
    }
}
