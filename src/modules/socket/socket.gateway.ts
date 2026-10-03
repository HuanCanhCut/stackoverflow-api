import { Logger } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Redis } from 'ioredis'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'

import type { JwtPayload } from '../../type.js'
import decodedToken from '../../utils/jwt.util.js'
import { SocketEvent } from './socket.enum.js'

type AuthenticatedSocket = Socket<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    { user: JwtPayload }
>

const userRoom = (userId: number) => `user:${userId}`

@WebSocketGateway({ cors: { origin: '*' } })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection {
    private readonly logger = new Logger(SocketGateway.name)

    @WebSocketServer()
    private readonly server: Server

    constructor(private readonly redis: Redis) {}

    afterInit(server: Server) {
        // Middleware của socket.io không nhận Promise, nên xử lý kết quả xác thực qua then / catch
        server.use((socket: AuthenticatedSocket, next) => {
            this.authenticate(socket)
                .then((payload) => {
                    socket.data.user = payload
                    next()
                })
                .catch((error: unknown) => {
                    next(error instanceof Error ? error : new Error('TOKEN_VERIFICATION_FAILED'))
                })
        })
    }

    /**
     * Xác thực giống AuthGuard: client gửi access token qua handshake.auth.token.
     * Message của Error là mã lỗi client nhận được trong connect_error.
     */
    private async authenticate(socket: AuthenticatedSocket): Promise<JwtPayload> {
        const token = (socket.handshake.auth as { token?: string }).token

        if (!token) {
            throw new Error('ACCESS_TOKEN_REQUIRED')
        }

        if (await this.redis.get(`access_token:${token}`)) {
            throw new Error('TOKEN_REVOKED')
        }

        let payload: JwtPayload | null

        try {
            payload = decodedToken(token)
        } catch (error) {
            // Client nhận TOKEN_EXPIRED thì refresh token rồi kết nối lại
            throw new Error(error instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'TOKEN_VERIFICATION_FAILED', {
                cause: error,
            })
        }

        if (!payload) {
            throw new Error('TOKEN_VERIFICATION_FAILED')
        }

        return payload
    }

    async handleConnection(socket: AuthenticatedSocket) {
        // Mỗi user một room để gửi sự kiện tới mọi thiết bị đang đăng nhập của user đó
        await socket.join(userRoom(socket.data.user.sub))
    }

    emitToUser<T>(userId: number, event: SocketEvent, payload: T) {
        this.server.to(userRoom(userId)).emit(event, payload)
        this.logger.log(`Emit ${event} to user ${userId}`)
    }
}
