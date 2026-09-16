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
    Req,
    UseGuards,
} from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import type { IRequest } from '../../type.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { GetQuestionRepliesDto } from './dto/get-question-replies.dto.js'
import { GetQuestionsDto } from './dto/get-questions.dto.js'
import { GetSavedQuestionsDto } from './dto/get-saved-questions.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'
import { QuestionsService } from './questions.service.js'

import { ResponsePagination } from '~/common/response/response.decorators.js'

@Controller('questions')
export class QuestionsController {
    constructor(private readonly questionsService: QuestionsService) {}

    @Post()
    @UseGuards(AuthGuard)
    async create(@Body() createQuestionDto: CreateQuestionDto, @Req() req: IRequest) {
        return this.questionsService.create(createQuestionDto, req.decoded.sub)
    }

    @Get()
    @ResponsePagination()
    findAll(@Query() query: GetQuestionsDto) {
        return this.questionsService.findAll(query)
    }

    @Get('saved')
    @UseGuards(AuthGuard)
    @ResponsePagination()
    findSavedQuestions(@Query() query: GetSavedQuestionsDto, @Req() req: IRequest) {
        return this.questionsService.findSavedQuestions(req.decoded.sub, query)
    }

    @Get(':id/replies')
    @ResponsePagination()
    findReplies(@Param('id', ParseIntPipe) id: number, @Query() query: GetQuestionRepliesDto) {
        return this.questionsService.findReplies(id, query)
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.questionsService.findOne(id)
    }

    @Post(':id/save')
    @UseGuards(AuthGuard)
    saveQuestion(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        return this.questionsService.saveQuestion(id, req.decoded.sub)
    }

    @Delete(':id/save')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AuthGuard)
    removeSavedQuestion(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        return this.questionsService.removeSavedQuestion(id, req.decoded.sub)
    }

    @Patch(':id/upvote')
    @UseGuards(AuthGuard)
    upvote(@Param('id', ParseIntPipe) id: number) {
        return this.questionsService.upvote(id)
    }

    @Patch(':id/downvote')
    @UseGuards(AuthGuard)
    downvote(@Param('id', ParseIntPipe) id: number) {
        return this.questionsService.downvote(id)
    }

    @Patch(':id')
    @UseGuards(AuthGuard)
    async update(@Param('id') id: string, @Body() updateQuestionDto: UpdateQuestionDto, @Req() req: IRequest) {
        return this.questionsService.update({ id: Number(id), updateQuestionDto, currentUserId: req.decoded.sub })
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AuthGuard)
    remove(@Param('id') id: string, @Req() req: IRequest) {
        return this.questionsService.remove({ id: Number(id), currentUserId: req.decoded.sub })
    }
}
