import { Transform } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

import { AdminPaginationDto } from '../dto/admin-pagination.dto.js'

import { EnumUserRole } from '~/generated/prisma/enums.js'

export enum AdminUserStatus {
    Active = 'active',
    Blocked = 'blocked',
}

export enum AdminUserSort {
    Newest = 'newest',
    Oldest = 'oldest',
}

export class GetAdminUsersDto extends AdminPaginationDto {
    @IsOptional()
    @IsEnum(EnumUserRole, { message: 'Role phải là user hoặc admin' })
    role?: EnumUserRole

    @IsOptional()
    @IsEnum(AdminUserStatus, { message: 'Status phải là active hoặc blocked' })
    status?: AdminUserStatus

    @IsEnum(AdminUserSort, { message: 'Sort phải là newest hoặc oldest' })
    sort = AdminUserSort.Newest
}

export class BlockUserDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Lý do phải là chuỗi' })
    @IsNotEmpty({ message: 'Vui lòng nhập lý do khóa' })
    @MaxLength(1000, { message: 'Lý do không được dài quá 1000 ký tự' })
    reason: string
}

export class UpdateUserRoleDto {
    @IsEnum(EnumUserRole, { message: 'Role phải là user hoặc admin' })
    role: EnumUserRole
}
