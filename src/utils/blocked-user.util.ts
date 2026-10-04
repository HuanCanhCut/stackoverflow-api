/**
 * Đánh dấu user bị khóa trong Redis để AuthGuard chặn ngay cả access token còn hạn,
 * không phải query DB ở mỗi request.
 */
export const blockedUserKey = (userId: number) => `blocked_user:${userId}`

export const USER_BLOCKED_CODE = 'USER_BLOCKED'
