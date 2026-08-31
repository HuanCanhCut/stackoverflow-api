import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator'

export class LoginDTO {
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string

    @IsNotEmpty({ message: 'Password không được để trống' })
    @IsString({ message: 'Password phải là chuỗi ký tự' })
    @Length(8, 50, {
        message: 'Password phải có độ dài từ 8 đến 50 ký tự',
    })
    password: string
}
