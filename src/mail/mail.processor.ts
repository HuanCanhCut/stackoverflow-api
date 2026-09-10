import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'

import { QueueEnum } from '../queue/queue.enum.js'
import { MailService } from './mail.service.js'

@Processor(QueueEnum.MAIL, { concurrency: 10 })
export class MailProcessor extends WorkerHost {
    constructor(private readonly mailService: MailService) {
        super()
    }

    async process(job: Job<{ email: string }>): Promise<void> {
        switch (job.name) {
            case QueueEnum.SEND_FORGOT_PASSWORD_CODE:
                await this.mailService.sendForgotPasswordCode(job.data.email)
                break

            default:
                throw new Error(`Unknown mail job: ${job.name}`)
        }
    }
}
