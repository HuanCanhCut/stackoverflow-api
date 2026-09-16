import { IsEnum } from 'class-validator'

import { GetQuestionsDto } from './get-questions.dto.js'

export enum QuestionRepliesOrderBy {
    Vote = 'vote',
    Newest = 'newest',
}

export class GetQuestionRepliesDto extends GetQuestionsDto {
    @IsEnum(QuestionRepliesOrderBy, {
        message: 'Order_by phải là vote hoặc newest',
    })
    order_by = QuestionRepliesOrderBy.Newest
}
