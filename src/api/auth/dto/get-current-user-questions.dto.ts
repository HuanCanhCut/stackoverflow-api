import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

export class GetCurrentUserQuestionsDto {
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
