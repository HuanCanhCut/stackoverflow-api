import { Injectable } from '@nestjs/common'

@Injectable()
export class MailService {
    constructor() {}

    async sendForgotPasswordCode(email: string) {
        console.log('Sending verification code to', email)
    }
}
