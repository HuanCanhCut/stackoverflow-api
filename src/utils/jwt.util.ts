import jwt from 'jsonwebtoken'

import type { JwtPayload } from '../type.js'

const decodedToken = (token: string): JwtPayload | null => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET as string) as unknown as JwtPayload
    } catch (error) {
        /**
         * Token hết hạn được xử lý tập trung bởi GlobalExceptionFilter để client
         * biết cần dùng refresh token. Các token không hợp lệ chỉ trả về null.
         */
        if (error instanceof jwt.TokenExpiredError) {
            throw error
        }

        return null
    }
}

export default decodedToken
