import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { QueueEnum } from '../../queue/queue.enum.js'
import { MailProcessor } from './mail.processor.js'
import { MailProducer } from './mail.producer.js'
import { MailService } from './mail.service.js'

@Module({
    imports: [
        BullModule.registerQueue({
            name: QueueEnum.MAIL,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
                removeOnFail: 5000,
            },
        }),
    ],
    providers: [MailService, MailProcessor, MailProducer],
    exports: [MailProducer],
})
export class MailModule {}
