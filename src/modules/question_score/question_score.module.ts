import { Module } from '@nestjs/common'

import { QuestionScoreService } from './question_score.service.js'

@Module({
    providers: [QuestionScoreService],
})
export class QuestionScoreModule {}
