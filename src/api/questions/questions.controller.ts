import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UnauthorizedException } from '@nestjs/common'

import { responseData } from '../../schemas/response/index.js'
import type { IRequest } from '../../type.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'
import { QuestionsService } from './questions.service.js'

@Controller('questions')
export class QuestionsController {
    constructor(private readonly questionsService: QuestionsService) {}

    @Post()
    async create(@Body() createQuestionDto: CreateQuestionDto, @Req() req: IRequest) {
        const decoded = req.decoded

        if (!decoded) {
            throw new UnauthorizedException()
        }

        const createdQuestion = await this.questionsService.create(createQuestionDto, decoded.sub)

        return responseData(createdQuestion)
    }

    @Get()
    findAll() {
        return this.questionsService.findAll()
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.questionsService.findOne(+id)
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateQuestionDto: UpdateQuestionDto, @Req() req: IRequest) {
        const decoded = req.decoded

        if (!decoded) {
            throw new UnauthorizedException()
        }

        const updatedQuestion = await this.questionsService.update(+id, updateQuestionDto)

        return responseData(updatedQuestion)
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.questionsService.remove(+id)
    }
}
