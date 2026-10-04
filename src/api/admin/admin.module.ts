import { Module } from '@nestjs/common'

import { AdminGuard } from '../../common/guards/admin.guard.js'
import { AuthGuard } from '../../common/guards/auth.guard.js'
import { ModerationModule } from '../../modules/moderation/moderation.module.js'
import { AdminQuestionsController } from './questions/admin-questions.controller.js'
import { AdminQuestionsService } from './questions/admin-questions.service.js'
import { AdminStatsController } from './stats/admin-stats.controller.js'
import { AdminStatsService } from './stats/admin-stats.service.js'
import { AdminTagsController } from './tags/admin-tags.controller.js'
import { AdminTagsService } from './tags/admin-tags.service.js'
import { AdminUsersController } from './users/admin-users.controller.js'
import { AdminUsersService } from './users/admin-users.service.js'

@Module({
    imports: [ModerationModule],
    controllers: [AdminStatsController, AdminUsersController, AdminQuestionsController, AdminTagsController],
    providers: [
        AdminStatsService,
        AdminUsersService,
        AdminQuestionsService,
        AdminTagsService,
        AuthGuard,
        AdminGuard,
    ],
})
export class AdminModule {}
