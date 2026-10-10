import { Transform, Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator'

export class SearchUsersDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Q phải là chuỗi' })
    @IsNotEmpty({ message: 'Vui lòng nhập từ khóa tìm kiếm' })
    @MaxLength(100, { message: 'Từ khóa không được dài quá 100 ký tự' })
    q: string

    @Type(() => Number)
    @IsInt({ message: 'Page phải là số nguyên' })
    @Min(1, { message: 'Page phải lớn hơn hoặc bằng 1' })
    page = 1

    @Type(() => Number)
    @IsInt({ message: 'Per page phải là số nguyên' })
    @Min(1, { message: 'Per page phải lớn hơn hoặc bằng 1' })
    @Max(50, { message: 'Per page không được lớn hơn 50' })
    per_page = 20
}
