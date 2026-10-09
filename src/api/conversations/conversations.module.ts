import { Module } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { UploadsService } from '../uploads/uploads.service.js'
import { ConversationsController } from './conversations.controller.js'
import { ConversationsService } from './conversations.service.js'

@Module({
    controllers: [ConversationsController],
    providers: [ConversationsService, UploadsService, AuthGuard],
})
export class ConversationsModule {}
