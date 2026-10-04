import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { NotificationsModule } from '../../api/notifications/notifications.module.js'
import { QueueEnum } from '../../queue/queue.enum.js'
import { ModerationProcessor } from './moderation.processor.js'
import { ModerationProducer } from './moderation.producer.js'
import { ModerationService } from './moderation.service.js'

@Module({
    imports: [
        BullModule.registerQueue({
            name: QueueEnum.MODERATION,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 10_000,
                },
                removeOnComplete: true,
                removeOnFail: 5000,
            },
        }),
        NotificationsModule,
    ],
    providers: [ModerationService, ModerationProcessor, ModerationProducer],
    exports: [ModerationProducer, ModerationService],
})
export class ModerationModule {}
