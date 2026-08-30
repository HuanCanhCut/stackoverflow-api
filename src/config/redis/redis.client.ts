// redis.provider.ts
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'

export const redisProvider = {
    provide: Redis,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
        const logger = new Logger('Redis')

        const redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
            retryStrategy(times) {
                return Math.min(times * 200, 3000)
            },
        })

        redis.on('error', (error) => {
            logger.error('Redis connection error', error)
        })

        redis.on('connect', () => {
            logger.log('Connected to Redis')
        })

        redis.on('reconnecting', () => {
            logger.warn('Reconnecting to Redis...')
        })

        return redis
    },
}
