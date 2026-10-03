import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { QueueEnum } from '../../queue/queue.enum.js'
import { ModerationService } from './moderation.service.js'
import type { ModerateQuestionJobData, ModerationJobStatus } from './moderation.type.js'

type ModerationJob = Job<ModerateQuestionJobData, ModerationJobStatus, QueueEnum>

@Processor(QueueEnum.MODERATION, {
    concurrency: 5,
    // Free tier của Google AI Studio giới hạn số request / phút
    limiter: { max: 15, duration: 60_000 },
})
export class ModerationProcessor extends WorkerHost {
    private readonly logger = new Logger(ModerationProcessor.name)

    constructor(private readonly moderationService: ModerationService) {
        super()
    }

    async process(job: ModerationJob): Promise<ModerationJobStatus> {
        switch (job.name) {
            case QueueEnum.MODERATE_QUESTION:
                return this.moderationService.moderateQuestion(job.data)

            default:
                throw new Error(`Unknown moderation job: ${job.name}`)
        }
    }

    @OnWorkerEvent('active')
    onActive(job: ModerationJob) {
        this.logger.log(
            `Job ${job.id} (${job.name}) started: question ${job.data.questionId}, attempt ${job.attemptsMade + 1}`,
        )
    }

    @OnWorkerEvent('completed')
    onCompleted(job: ModerationJob, status: ModerationJobStatus) {
        this.logger.log(
            `Job ${job.id} (${job.name}) finished: question ${job.data.questionId}, status ${status}, took ${this.duration(job)}`,
        )
    }

    @OnWorkerEvent('failed')
    onFailed(job: ModerationJob | undefined, error: Error) {
        if (!job) {
            this.logger.error(`Moderation job failed: ${error.message}`, error.stack)
            return
        }

        this.logger.error(
            `Job ${job.id} (${job.name}) failed: question ${job.data.questionId}, attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}, took ${this.duration(job)}: ${error.message}`,
            error.stack,
        )
    }

    private duration(job: ModerationJob) {
        return job.processedOn ? `${Date.now() - job.processedOn}ms` : 'n/a'
    }
}
