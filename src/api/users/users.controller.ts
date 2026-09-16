import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common'

import { ResponsePagination } from '../../common/response/response.decorators.js'
import { GetUserQuestionsDto } from './dto/get-user-questions.dto.js'
import { UsersService } from './users.service.js'

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

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
}
