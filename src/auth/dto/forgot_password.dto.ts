import { IsEmail } from 'class-validator'

export class SendForgotPasswordCodeDTO {
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string
}
