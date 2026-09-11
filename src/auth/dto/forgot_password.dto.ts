import { IsEmail, IsNotEmpty, IsNumber, IsString, Length } from 'class-validator'

import { AuthEnum } from '../../enum/auth.enum.js'

export class SendForgotPasswordCodeDTO {
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string
}

export class ResetPasswordDTO {
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string

    @IsNotEmpty({ message: 'Password không được để trống' })
    @IsString({ message: 'Password phải là chuỗi ký tự' })
    @Length(AuthEnum.MIN_PASSWORD_LENGTH, AuthEnum.MAX_PASSWORD_LENGTH, {
        message: `Password phải có độ dài từ ${AuthEnum.MIN_PASSWORD_LENGTH} đến ${AuthEnum.MAX_PASSWORD_LENGTH} ký tự`,
    })
    password: string

    @IsNumber()
    @IsNotEmpty()
    @Length(6, 6, { message: 'Mã xác nhận phải có 6 ký tự' })
    code: number
}
