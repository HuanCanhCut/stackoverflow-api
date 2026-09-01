import { IsNotEmpty, IsString } from 'class-validator'

export class RefreshTokenDTO {
    @IsString({
        message: 'refresh_token must be a string',
    })
    @IsNotEmpty({
        message: 'refresh_token is required',
    })
    refresh_token: string
}
