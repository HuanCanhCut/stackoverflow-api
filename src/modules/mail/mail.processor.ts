import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'

import { QueueEnum } from '../../queue/queue.enum.js'
import { MailService } from './mail.service.js'

@Processor(QueueEnum.MAIL, { concurrency: 10 })
export class MailProcessor extends WorkerHost {
    constructor(private readonly mailService: MailService) {
        super()
    }

    async process(job: Job<{ email: string }, void, QueueEnum>): Promise<void> {
        switch (job.name) {
            case QueueEnum.SEND_FORGOT_PASSWORD_CODE: {
                console.log(
                    `\x1b[33m [Mail Worker] Processing job ${job.id}: sending reset password to ${job.data.email} \x1b[0m`,
                )

                await this.mailService.sendForgotPasswordCode(job.data.email)

                console.log(`\x1b[32m [Mail Worker] Job ${job.id}: sent reset password to ${job.data.email} \x1b[0m`)

                break
            }

            default:
                throw new Error(`Unknown mail job: ${job.name}`)
        }
    }
}
