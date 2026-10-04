import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common'

import { AdminGuard } from '../../../common/guards/admin.guard.js'
import { AuthGuard } from '../../../common/guards/auth.guard.js'
import { ResponsePagination } from '../../../common/response/response.decorators.js'
import type { IRequest } from '../../../type.js'
import { BlockUserDto, GetAdminUsersDto, UpdateUserRoleDto } from './admin-users.dto.js'
import { AdminUsersService } from './admin-users.service.js'

@Controller('admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class AdminUsersController {
    constructor(private readonly adminUsersService: AdminUsersService) {}

    @Get()
    @ResponsePagination()
    findAll(@Query() query: GetAdminUsersDto) {
        return this.adminUsersService.findAll(query)
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.adminUsersService.findOne(id)
    }

    @Patch(':id/block')
    block(@Param('id', ParseIntPipe) id: number, @Body() body: BlockUserDto, @Req() req: IRequest) {
        return this.adminUsersService.block(id, body.reason, req.decoded.sub)
    }

    @Patch(':id/unblock')
    unblock(@Param('id', ParseIntPipe) id: number, @Req() req: IRequest) {
        return this.adminUsersService.unblock(id, req.decoded.sub)
    }

    @Patch(':id/role')
    updateRole(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserRoleDto, @Req() req: IRequest) {
        return this.adminUsersService.updateRole(id, body, req.decoded.sub)
    }
}
