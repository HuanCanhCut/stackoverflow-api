import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator'

export class UpdateCurrentUserDto {
    @IsOptional()
    @IsString({ message: 'Tên phải là chuỗi' })
    @MaxLength(191, { message: 'Tên không được vượt quá 191 ký tự' })
    first_name?: string | null

    @IsOptional()
    @IsString({ message: 'Họ phải là chuỗi' })
    @MaxLength(191, { message: 'Họ không được vượt quá 191 ký tự' })
    last_name?: string | null

    @ValidateIf((_, value) => value !== undefined)
    @IsString({ message: 'Nickname phải là chuỗi' })
    @IsNotEmpty({ message: 'Nickname không được để trống' })
    @MaxLength(100, { message: 'Nickname không được vượt quá 100 ký tự' })
    nickname?: string

    // Client gửi upload_id của ảnh đã tải lên S3; server tự xác thực và dựng avatar_path công khai
    @IsOptional()
    @IsString({ message: 'Avatar_upload_id phải là chuỗi' })
    avatar_upload_id?: string

    @IsOptional()
    @IsString({ message: 'Bio phải là chuỗi' })
    @MaxLength(500, { message: 'Bio không được vượt quá 500 ký tự' })
    bio?: string | null
}
