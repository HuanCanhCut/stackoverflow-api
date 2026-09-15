import { Module } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { UploadsService } from '../uploads/uploads.service.js'
import { QuestionsController } from './questions.controller.js'
import { QuestionsService } from './questions.service.js'

@Module({
    controllers: [QuestionsController],
    providers: [QuestionsService, UploadsService, AuthGuard],
})
export class QuestionsModule {}
