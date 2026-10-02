export const MODERATION_CATEGORIES = ['politics', 'misinformation', 'indecent'] as const

export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number]

export interface ModerationResult {
    violated: boolean
    categories: ModerationCategory[]
    reason: string
}

export interface ModerateQuestionJobData {
    questionId: number
    /** updated_at lúc tạo job, dùng để bỏ qua job cũ khi nội dung đã bị sửa tiếp */
    updatedAt: string
}

export interface QuestionModeratedPayload {
    question_id: number
    parent_id: number | null
    title: string
    status: 'rejected'
    categories: ModerationCategory[]
    reason: string
}

/** Kết quả của job kiểm duyệt; skipped khi chưa cấu hình LLM hoặc nội dung đã bị xoá / sửa tiếp */
export type ModerationJobStatus = 'approved' | 'rejected' | 'skipped'
