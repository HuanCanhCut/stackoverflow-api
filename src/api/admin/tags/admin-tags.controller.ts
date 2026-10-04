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
import { GetAdminTagsDto, MergeTagDto, SaveTagDto } from './admin-tags.dto.js'
import { AdminTagsService } from './admin-tags.service.js'

@Controller('admin/tags')
@UseGuards(AuthGuard, AdminGuard)
export class AdminTagsController {
    constructor(private readonly adminTagsService: AdminTagsService) {}

    @Get()
    @ResponsePagination()
    findAll(@Query() query: GetAdminTagsDto) {
        return this.adminTagsService.findAll(query)
    }

    @Post()
    create(@Body() body: SaveTagDto) {
        return this.adminTagsService.create(body.name)
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveTagDto) {
        return this.adminTagsService.update(id, body.name)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.adminTagsService.remove(id)
    }

    @Post(':id/merge')
    @HttpCode(HttpStatus.OK)
    merge(@Param('id', ParseIntPipe) id: number, @Body() body: MergeTagDto) {
        return this.adminTagsService.merge(id, body.target_id)
    }
}
