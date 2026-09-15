import { Module } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { UploadsController } from './uploads.controller.js'
import { UploadsService } from './uploads.service.js'

@Module({
    controllers: [UploadsController],
    providers: [UploadsService, AuthGuard],
})
export class UploadsModule {}
