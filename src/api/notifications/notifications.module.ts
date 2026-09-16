import { Module } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { NotificationsController } from './notifications.controller.js'
import { NotificationsService } from './notifications.service.js'

@Module({
    controllers: [NotificationsController],
    providers: [NotificationsService, AuthGuard],
    exports: [NotificationsService],
})
export class NotificationsModule {}
