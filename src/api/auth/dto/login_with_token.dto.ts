import { IsString } from 'class-validator'

export class loginWithTokenDTO {
    @IsString()
    token: string
}
