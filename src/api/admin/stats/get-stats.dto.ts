import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

export class GetStatsDto {
    @Type(() => Number)
    @IsInt({ message: 'Days phải là số nguyên' })
    @Min(1, { message: 'Days phải lớn hơn hoặc bằng 1' })
    @Max(365, { message: 'Days không được lớn hơn 365' })
    days = 30
}
