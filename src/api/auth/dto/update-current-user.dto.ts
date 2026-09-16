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

    @IsOptional()
    @IsString({ message: 'Avatar_path phải là chuỗi' })
    @MaxLength(191, { message: 'Avatar_path không được vượt quá 191 ký tự' })
    avatar_path?: string | null

    @IsOptional()
    @IsString({ message: 'Bio phải là chuỗi' })
    @MaxLength(500, { message: 'Bio không được vượt quá 500 ký tự' })
    bio?: string | null
}
