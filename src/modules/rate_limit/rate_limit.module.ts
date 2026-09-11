import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { Redis } from 'ioredis'

import { RedisModule } from '../../config/redis/redis.module.js'

@Module({
    imports: [
        RedisModule,
        ThrottlerModule.forRootAsync({
            imports: [RedisModule],
            inject: [Redis],

            useFactory: (redis: Redis) => ({
                throttlers: [
                    {
                        ttl: seconds(60),
                        limit: 200,
                    },
                ],

                storage: new ThrottlerStorageRedisService(redis),
            }),
        }),
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class RateLimitModule {}
