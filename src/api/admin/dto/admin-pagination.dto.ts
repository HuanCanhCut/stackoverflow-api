import { Transform, Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class AdminPaginationDto {
    @Type(() => Number)
    @IsInt({ message: 'Page phải là số nguyên' })
    @Min(1, { message: 'Page phải lớn hơn hoặc bằng 1' })
    page = 1

    @Type(() => Number)
    @IsInt({ message: 'Per page phải là số nguyên' })
    @Min(1, { message: 'Per page phải lớn hơn hoặc bằng 1' })
    @Max(100, { message: 'Per page không được lớn hơn 100' })
    per_page = 20

    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
    @IsString({ message: 'Search phải là chuỗi' })
    @MaxLength(255, { message: 'Search không được dài quá 255 ký tự' })
    search?: string
}

export const toPagination = <T>(data: T[], total: number, { page, per_page }: AdminPaginationDto) => ({
    data,
    total,
    count: data.length,
    current_page: page,
    per_page,
})
