import { Controller, Get, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { ResponsePagination } from '../../common/response/response.decorators.js'
import type { IRequest } from '../../type.js'
import { GetUserQuestionsDto } from './dto/get-user-questions.dto.js'
import { SearchUsersDto } from './dto/search-users.dto.js'
import { UsersService } from './users.service.js'

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // Tìm người để bắt đầu nhắn tin. Khai báo trước ':id' để "search" không bị ParseIntPipe bắt nhầm
    @Get('search')
    @UseGuards(AuthGuard)
    @ResponsePagination()
    search(@Query() query: SearchUsersDto, @Req() req: IRequest) {
        return this.usersService.search({ ...query, currentUserId: req.decoded.sub })
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.findOne(id)
    }

    @Get(':id/questions')
    @ResponsePagination()
    findQuestions(@Param('id', ParseIntPipe) id: number, @Query() query: GetUserQuestionsDto) {
        return this.usersService.findQuestions(id, query)
    }

    @Get(':id/answered-questions')
    @ResponsePagination()
    findAnsweredQuestions(@Param('id', ParseIntPipe) id: number, @Query() query: GetUserQuestionsDto) {
        return this.usersService.findAnsweredQuestions(id, query)
    }

    // Các câu trả lời do chính người dùng viết (trả lời câu hỏi và phản hồi câu trả lời khác)
    @Get(':id/answers')
    @ResponsePagination()
    findAnswers(@Param('id', ParseIntPipe) id: number, @Query() query: GetUserQuestionsDto) {
        return this.usersService.findAnswers(id, query)
    }
}
