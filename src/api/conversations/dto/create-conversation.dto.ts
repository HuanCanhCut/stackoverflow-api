import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

export class CreateConversationDto {
    @Type(() => Number)
    @IsInt({ message: 'User_id phải là số nguyên' })
    @Min(1, { message: 'User_id phải lớn hơn hoặc bằng 1' })
    user_id: number
}
