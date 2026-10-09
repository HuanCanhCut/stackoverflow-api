import { Transform } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class SendMessageDto {
    // Chuỗi rỗng/toàn khoảng trắng coi như không có nội dung (tin nhắn chỉ có ảnh)
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
    @IsString({ message: 'Content phải là chuỗi' })
    @MaxLength(5000, { message: 'Tin nhắn không được dài quá 5000 ký tự' })
    content?: string

    // upload_id nhận được khi lấy presigned URL với folder "messages"
    @IsOptional()
    @IsArray({ message: 'Upload_ids phải là mảng' })
    @ArrayMaxSize(10, { message: 'Không được gửi quá 10 ảnh trong một tin nhắn' })
    @IsUUID('4', { each: true, message: 'Upload_id không hợp lệ' })
    upload_ids: string[] = []
}
