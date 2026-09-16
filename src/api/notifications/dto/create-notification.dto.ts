import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator'

export class CreateNotificationDto {
    @IsString({ message: 'Nội dung notification phải là chuỗi' })
    @IsNotEmpty({ message: 'Nội dung notification không được để trống' })
    @MaxLength(255, { message: 'Nội dung notification không được vượt quá 255 ký tự' })
    content: string

    @IsOptional()
    @IsObject({ message: 'Metadata phải là object' })
    metadata?: Record<string, unknown> | null

    @IsArray({ message: 'Recipient_ids phải là mảng' })
    @ArrayMinSize(1, { message: 'Phải có ít nhất một người nhận' })
    @ArrayUnique({ message: 'Recipient_ids không được trùng nhau' })
    @IsInt({ each: true, message: 'Mỗi recipient_id phải là số nguyên' })
    recipient_ids: number[]
}
