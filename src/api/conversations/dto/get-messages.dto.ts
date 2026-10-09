import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class GetMessagesDto {
    // Id của tin nhắn cũ nhất đã tải, lấy tiếp các tin nhắn cũ hơn nó. Bỏ trống để lấy tin mới nhất
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Cursor phải là số nguyên' })
    @Min(1, { message: 'Cursor phải lớn hơn hoặc bằng 1' })
    cursor?: number

    @Type(() => Number)
    @IsInt({ message: 'Limit phải là số nguyên' })
    @Min(1, { message: 'Limit phải lớn hơn hoặc bằng 1' })
    @Max(100, { message: 'Limit không được lớn hơn 100' })
    limit = 30
}
