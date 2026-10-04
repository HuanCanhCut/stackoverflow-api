import { Controller, Get, Query, UseGuards } from '@nestjs/common'

import { AdminGuard } from '../../../common/guards/admin.guard.js'
import { AuthGuard } from '../../../common/guards/auth.guard.js'
import { AdminStatsService } from './admin-stats.service.js'
import { GetStatsDto } from './get-stats.dto.js'

@Controller('admin/stats')
@UseGuards(AuthGuard, AdminGuard)
export class AdminStatsController {
    constructor(private readonly adminStatsService: AdminStatsService) {}

    @Get()
    getStats(@Query() query: GetStatsDto) {
        return this.adminStatsService.getStats(query)
    }
}
