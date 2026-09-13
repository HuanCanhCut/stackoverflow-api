import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'

import { AuthMiddleware } from '../../middleware/auth/auth.middleware.js'
import { QuestionsController } from './questions.controller.js'
import { QuestionsService } from './questions.service.js'

@Module({
    controllers: [QuestionsController],
    providers: [QuestionsService],
})
export class QuestionsModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(AuthMiddleware)
            .exclude({
                path: 'questions',
                method: RequestMethod.GET,
            })
            .forRoutes(QuestionsController)
    }
}
