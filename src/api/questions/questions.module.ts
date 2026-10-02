import { Module } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard.js'
import { ModerationModule } from '../../modules/moderation/moderation.module.js'
import { UploadsService } from '../uploads/uploads.service.js'
import { QuestionsController } from './questions.controller.js'
import { QuestionsService } from './questions.service.js'

@Module({
    imports: [ModerationModule],
    controllers: [QuestionsController],
    providers: [QuestionsService, UploadsService, AuthGuard, OptionalAuthGuard],
})
export class QuestionsModule {}
