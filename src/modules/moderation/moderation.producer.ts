import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'

import { QueueEnum } from '../../queue/queue.enum.js'
import type { ModerateQuestionJobData } from './moderation.type.js'

@Injectable()
export class ModerationProducer {
    private readonly logger = new Logger(ModerationProducer.name)

    constructor(
        @InjectQueue(QueueEnum.MODERATION)
        private readonly moderationQueue: Queue<ModerateQuestionJobData>,
    ) {}

    async moderateQuestion({ id, updated_at }: { id: number; updated_at: Date }) {
        const job = await this.moderationQueue.add(QueueEnum.MODERATE_QUESTION, {
            questionId: id,
            updatedAt: updated_at.toISOString(),
        })

        this.logger.log(`Job ${job.id} (${job.name}) queued: question ${id}`)
    }
}
