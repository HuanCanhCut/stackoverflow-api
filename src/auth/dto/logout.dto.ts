import { IsOptional, IsString } from 'class-validator'

export class LogoutDTO {
    @IsString()
    @IsOptional()
    access_token?: string

    @IsString()
    @IsOptional()
    refresh_token?: string
}
