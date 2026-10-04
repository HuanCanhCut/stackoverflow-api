import { Transform, Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class GetQuestionsDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Tag_id phải là số nguyên' })
    @Min(1, { message: 'Tag_id phải lớn hơn hoặc bằng 1' })
    tag_id?: number

    // Chuỗi rỗng/toàn khoảng trắng coi như không tìm kiếm
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
    @IsString({ message: 'Search phải là chuỗi' })
    @MaxLength(255, { message: 'Search không được dài quá 255 ký tự' })
    search?: string

    @Type(() => Number)
    @IsInt({ message: 'Page phải là số nguyên' })
    @Min(1, { message: 'Page phải lớn hơn hoặc bằng 1' })
    page = 1

    @Type(() => Number)
    @IsInt({ message: 'Per page phải là số nguyên' })
    @Min(1, { message: 'Per page phải lớn hơn hoặc bằng 1' })
    @Max(100, { message: 'Per page không được lớn hơn 100' })
    per_page = 10
}
