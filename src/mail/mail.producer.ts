// mail.service.ts
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bullmq'

import { QueueEnum } from '../queue/queue.enum.js'

@Injectable()
export class MailProducer {
    constructor(
        @InjectQueue(QueueEnum.MAIL)
        private readonly mailQueue: Queue,
    ) {}

    async sendForgotPasswordCode(email: string) {
        await this.mailQueue.add(QueueEnum.SEND_FORGOT_PASSWORD_CODE, { email })
    }
}
