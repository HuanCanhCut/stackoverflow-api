import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { ResponseCursorPagination, ResponsePagination } from '../../common/response/response.decorators.js'
import type { IRequest } from '../../type.js'
import { ConversationsService } from './conversations.service.js'
import { CreateConversationDto } from './dto/create-conversation.dto.js'
import { GetConversationsDto } from './dto/get-conversations.dto.js'
import { GetMessagesDto } from './dto/get-messages.dto.js'
import { SendMessageDto } from './dto/send-message.dto.js'

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) {}

    // Bấm "Nhắn tin" ở trang cá nhân: trả về hội thoại sẵn có hoặc tạo mới
    @Post()
    @HttpCode(HttpStatus.OK)
    findOrCreate(@Body() body: CreateConversationDto, @Req() req: IRequest) {
        return this.conversationsService.findOrCreate({ userId: body.user_id, currentUserId: req.decoded.sub })
    }

    @Get()
    @ResponsePagination()
    findAll(@Query() query: GetConversationsDto, @Req() req: IRequest) {
        return this.conversationsService.findAll({ ...query, currentUserId: req.decoded.sub })
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        return this.conversationsService.findOne({ id, currentUserId: req.decoded.sub })
    }

    @Get(':id/messages')
    @ResponseCursorPagination()
    findMessages(@Param('id', ParseIntPipe) id: number, @Query() query: GetMessagesDto, @Req() req: IRequest) {
        return this.conversationsService.findMessages({ ...query, id, currentUserId: req.decoded.sub })
    }

    @Post(':id/messages')
    sendMessage(@Param('id', ParseIntPipe) id: number, @Body() body: SendMessageDto, @Req() req: IRequest) {
        return this.conversationsService.sendMessage({ ...body, id, currentUserId: req.decoded.sub })
    }

    @Patch(':id/read')
    @HttpCode(HttpStatus.NO_CONTENT)
    async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        await this.conversationsService.markAsRead({ id, currentUserId: req.decoded.sub })
    }
}
