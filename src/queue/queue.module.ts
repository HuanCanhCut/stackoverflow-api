import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { bullConfig } from './queue.config.js'

@Module({
    imports: [
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: bullConfig,
        }),
    ],
    exports: [BullModule],
})
export class QueueModule {}
