import { Transform, Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator'

import { AdminPaginationDto } from '../dto/admin-pagination.dto.js'

import { EnumModerationStatus } from '~/generated/prisma/enums.js'

export enum AdminQuestionType {
    All = 'all',
    Question = 'question',
    Answer = 'answer',
}

export enum AdminQuestionSort {
    Newest = 'newest',
    Oldest = 'oldest',
    Votes = 'votes',
}

export class GetAdminQuestionsDto extends AdminPaginationDto {
    @IsEnum(AdminQuestionType, { message: 'Type phải là all, question hoặc answer' })
    type = AdminQuestionType.All

    @IsOptional()
    @IsEnum(EnumModerationStatus, { message: 'Moderation_status phải là pending, approved hoặc rejected' })
    moderation_status?: EnumModerationStatus

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Tag_id phải là số nguyên' })
    @Min(1, { message: 'Tag_id phải lớn hơn hoặc bằng 1' })
    tag_id?: number

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Author_id phải là số nguyên' })
    @Min(1, { message: 'Author_id phải lớn hơn hoặc bằng 1' })
    author_id?: number

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Parent_id phải là số nguyên' })
    @Min(1, { message: 'Parent_id phải lớn hơn hoặc bằng 1' })
    parent_id?: number

    @IsEnum(AdminQuestionSort, { message: 'Sort phải là newest, oldest hoặc votes' })
    sort = AdminQuestionSort.Newest
}

export enum AdminModerationDecision {
    Approved = 'approved',
    Rejected = 'rejected',
}

export class ModerateQuestionDto {
    @IsEnum(AdminModerationDecision, { message: 'Status phải là approved hoặc rejected' })
    status: AdminModerationDecision

    // Bắt buộc khi từ chối: lý do được gửi cho tác giả
    @ValidateIf((dto: ModerateQuestionDto) => dto.status === AdminModerationDecision.Rejected)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Lý do phải là chuỗi' })
    @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
    @MaxLength(500, { message: 'Lý do không được dài quá 500 ký tự' })
    reason?: string
}
