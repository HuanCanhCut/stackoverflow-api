import { Transform, Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator'

import { AdminPaginationDto } from '../dto/admin-pagination.dto.js'

export enum AdminTagSort {
    Name = 'name',
    Usage = 'usage',
    Newest = 'newest',
}

export class GetAdminTagsDto extends AdminPaginationDto {
    @IsEnum(AdminTagSort, { message: 'Sort phải là name, usage hoặc newest' })
    sort = AdminTagSort.Name
}

export class SaveTagDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Tên tag phải là chuỗi' })
    @IsNotEmpty({ message: 'Vui lòng nhập tên tag' })
    @MaxLength(50, { message: 'Tên tag không được dài quá 50 ký tự' })
    name: string
}

export class MergeTagDto {
    @Type(() => Number)
    @IsInt({ message: 'Target_id phải là số nguyên' })
    @Min(1, { message: 'Target_id phải lớn hơn hoặc bằng 1' })
    target_id: number
}
