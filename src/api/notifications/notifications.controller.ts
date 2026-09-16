import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { ResponsePagination } from '../../common/response/response.decorators.js'
import type { IRequest } from '../../type.js'
import { CreateNotificationDto } from './dto/create-notification.dto.js'
import { GetNotificationsDto } from './dto/get-notifications.dto.js'
import { NotificationsService } from './notifications.service.js'

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Post()
    create(@Body() body: CreateNotificationDto, @Req() req: IRequest) {
        return this.notificationsService.create({
            ...body,
            actorId: req.decoded.sub,
        })
    }

    @Get()
    @ResponsePagination()
    findAll(@Query() query: GetNotificationsDto, @Req() req: IRequest) {
        return this.notificationsService.findAll({
            ...query,
            currentUserId: req.decoded.sub,
        })
    }

    @Patch('seen')
    @HttpCode(HttpStatus.NO_CONTENT)
    async markAllAsSeen(@Req() req: IRequest) {
        await this.notificationsService.markAllAsSeen(req.decoded.sub)
    }

    @Patch(':id/read')
    @HttpCode(HttpStatus.NO_CONTENT)
    async markAsRead(@Param('id') id: string, @Req() req: IRequest) {
        await this.notificationsService.markAsRead({
            id,
            currentUserId: req.decoded.sub,
        })
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string, @Req() req: IRequest) {
        await this.notificationsService.remove({
            id,
            currentUserId: req.decoded.sub,
        })
    }
}
