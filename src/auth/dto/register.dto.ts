import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator'

import { AuthEnum } from '../../enum/auth.enum.js'

export class RegisterDTO {
    @IsString({ message: 'Email phải là chuỗi' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string

    @IsString({ message: 'Password phải là chuỗi' })
    @IsNotEmpty({ message: 'Password không được để trống' })
    @Length(AuthEnum.MIN_PASSWORD_LENGTH, AuthEnum.MAX_PASSWORD_LENGTH, {
        message: `Password phải có độ dài từ ${AuthEnum.MIN_PASSWORD_LENGTH} đến ${AuthEnum.MAX_PASSWORD_LENGTH} ký tự`,
    })
    password: string

    @IsString({ message: 'Họ và tên phải là chuỗi' })
    @IsNotEmpty({ message: 'Họ và tên không được để trống' })
    @Matches(/\S+\s+\S+/, {
        message: 'Họ và tên phải có ít nhất 2 từ',
    })
    full_name: string
}
