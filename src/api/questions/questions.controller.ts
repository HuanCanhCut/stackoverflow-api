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
    Req,
    UnauthorizedException,
} from '@nestjs/common'

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

        return this.questionsService.create(createQuestionDto, decoded.sub)
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

        return this.questionsService.update({ id: Number(id), updateQuestionDto, currentUserId: decoded.sub })
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string, @Req() req: IRequest) {
        const decoded = req.decoded

        if (!decoded) {
            throw new UnauthorizedException({ message: 'Unauthorized' })
        }

        return this.questionsService.remove({ id: Number(id), currentUserId: decoded.sub })
    }
}
