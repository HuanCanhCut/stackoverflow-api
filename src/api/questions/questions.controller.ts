import {
    BadRequestException,
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
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { seconds, Throttle } from '@nestjs/throttler'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard.js'
import { ImageSearchService } from '../../modules/image_search/image_search.service.js'
import type { IRequest } from '../../type.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { GetQuestionRepliesDto } from './dto/get-question-replies.dto.js'
import { GetQuestionsDto } from './dto/get-questions.dto.js'
import { GetSavedQuestionsDto } from './dto/get-saved-questions.dto.js'
import { UpdateQuestionDto } from './dto/update-question.dto.js'
import { QuestionsService, VoteType } from './questions.service.js'

import { ResponsePagination } from '~/common/response/response.decorators.js'

const IMAGE_SEARCH_MAX_SIZE_BYTES = 5 * 1024 * 1024
const IMAGE_SEARCH_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

@Controller('questions')
export class QuestionsController {
    constructor(
        private readonly questionsService: QuestionsService,
        private readonly imageSearchService: ImageSearchService,
    ) {}

    @Post()
    @UseGuards(AuthGuard)
    async create(@Body() createQuestionDto: CreateQuestionDto, @Req() req: IRequest) {
        return this.questionsService.create(createQuestionDto, req.decoded.sub)
    }

    @Get()
    @UseGuards(OptionalAuthGuard)
    @ResponsePagination()
    findAll(@Query() query: GetQuestionsDto, @Req() req: IRequest) {
        return this.questionsService.findAll(query, req.decoded?.sub)
    }

    // Đọc chữ trong ảnh bằng LLM rồi trả về câu truy vấn, client dùng nó để gọi GET /questions?search=.
    // Mỗi lần gọi tốn quota Gemini nên giới hạn chặt theo IP
    @Throttle({
        default: {
            limit: 10,
            ttl: seconds(60),
        },
    })
    @Post('search-by-image')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FileInterceptor('image', {
            limits: { fileSize: IMAGE_SEARCH_MAX_SIZE_BYTES, files: 1 },
            fileFilter: (_req, file, callback) => {
                if (!IMAGE_SEARCH_MIME_TYPES.includes(file.mimetype)) {
                    return callback(
                        new BadRequestException({ message: 'Chỉ chấp nhận ảnh định dạng JPEG, PNG hoặc WEBP' }),
                        false,
                    )
                }

                callback(null, true)
            },
        }),
    )
    searchByImage(@UploadedFile() image?: Express.Multer.File) {
        if (!image) {
            throw new BadRequestException({ message: 'Vui lòng gửi kèm ảnh cần tìm kiếm' })
        }

        return this.imageSearchService.extractQuery(image)
    }

    @Get('saved')
    @UseGuards(AuthGuard)
    @ResponsePagination()
    findSavedQuestions(@Query() query: GetSavedQuestionsDto, @Req() req: IRequest) {
        return this.questionsService.findSavedQuestions(req.decoded.sub, query)
    }

    @Get(':id/replies')
    @UseGuards(OptionalAuthGuard)
    @ResponsePagination()
    findReplies(@Param('id', ParseIntPipe) id: number, @Query() query: GetQuestionRepliesDto, @Req() req: IRequest) {
        return this.questionsService.findReplies(id, query, req.decoded?.sub)
    }

    @Get(':id')
    @UseGuards(OptionalAuthGuard)
    findOne(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        return this.questionsService.findOne(id, req.decoded?.sub)
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
    upvote(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        return this.questionsService.vote({
            id,
            type: VoteType.Upvote,
            currentUserId: req.decoded.sub,
        })
    }

    @Patch(':id/downvote')
    @UseGuards(AuthGuard)
    downvote(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        return this.questionsService.vote({
            id,
            type: VoteType.Downvote,
            currentUserId: req.decoded.sub,
        })
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
