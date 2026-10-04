import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common'

import { AdminGuard } from '../../../common/guards/admin.guard.js'
import { AuthGuard } from '../../../common/guards/auth.guard.js'
import { ResponsePagination } from '../../../common/response/response.decorators.js'
import { GetAdminQuestionsDto, ModerateQuestionDto } from './admin-questions.dto.js'
import { AdminQuestionsService } from './admin-questions.service.js'

@Controller('admin/questions')
@UseGuards(AuthGuard, AdminGuard)
export class AdminQuestionsController {
    constructor(private readonly adminQuestionsService: AdminQuestionsService) {}

    @Get()
    @ResponsePagination()
    findAll(@Query() query: GetAdminQuestionsDto) {
        return this.adminQuestionsService.findAll(query)
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.adminQuestionsService.findOne(id)
    }

    @Patch(':id/moderation')
    moderate(@Param('id', ParseIntPipe) id: number, @Body() body: ModerateQuestionDto) {
        return this.adminQuestionsService.moderate(id, body)
    }

    @Post(':id/re-moderate')
    @HttpCode(HttpStatus.OK)
    reModerate(@Param('id', ParseIntPipe) id: number) {
        return this.adminQuestionsService.reModerate(id)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.adminQuestionsService.remove(id)
    }
}
