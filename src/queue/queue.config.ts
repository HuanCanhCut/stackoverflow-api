import { BullRootModuleOptions } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'

export const bullConfig = (config: ConfigService): BullRootModuleOptions => ({
    connection: {
        host: config.getOrThrow<string>('REDIS_HOST'),
        port: config.getOrThrow<number>('REDIS_PORT'),
    },
})
