import { Controller, Get, Query } from '@nestjs/common'

import { ResponsePagination } from '../../common/response/response.decorators.js'
import { GetTagsDto } from './dto/get-tags.dto.js'
import { TagsService } from './tags.service.js'

@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) {}

    @Get()
    @ResponsePagination()
    findAll(@Query() query: GetTagsDto) {
        return this.tagsService.findAll(query)
    }
}
