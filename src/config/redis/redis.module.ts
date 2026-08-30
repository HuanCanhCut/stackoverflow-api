import { Global, Module } from '@nestjs/common'
import { redisProvider } from './redis.client.js'

@Global()
@Module({
    providers: [redisProvider],
    exports: [redisProvider],
})
export class RedisModule {}
