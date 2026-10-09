import { Module } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard.js'
import { ImageSearchModule } from '../../modules/image_search/image_search.module.js'
import { ModerationModule } from '../../modules/moderation/moderation.module.js'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { UploadsService } from '../uploads/uploads.service.js'
import { QuestionsController } from './questions.controller.js'
import { QuestionsService } from './questions.service.js'

@Module({
    imports: [ModerationModule, NotificationsModule, ImageSearchModule],
    controllers: [QuestionsController],
    providers: [QuestionsService, UploadsService, AuthGuard, OptionalAuthGuard],
})
export class QuestionsModule {}
