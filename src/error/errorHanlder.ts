import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TracerService } from '@nestjs/observe'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { snakeCaseKeys } from '../utils/object.util.js'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(
        private readonly tracerService: TracerService,
        private readonly configService: ConfigService,
    ) {}

    async catch(exception: Error, host: ArgumentsHost) {
        const ctx = host.switchToHttp()

        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()

        const isExpiredTokenError = exception instanceof jwt.TokenExpiredError
        const status = this.getHttpStatus(exception)

        const shouldCaptureError = this.configService.get<string>('OBSERVE_ENABLED', 'true') === 'true'

        // Observe vẫn nhận lỗi thật
        if (status >= 500 && shouldCaptureError) {
            await this.tracerService.captureError(exception, {
                method: request.method,
                path: request.originalUrl,
                status_code: String(status),
            })
        }

        const isProduction = process.env.NODE_ENV === 'production'

        let normalizedResponse

        if (isExpiredTokenError) {
            response.set('x-refresh-token-required', 'true')

            normalizedResponse = {
                error: 'Xác thực thất bại do token hết hạn.',
                code: 'TOKEN_EXPIRED',
            }
        } else if (isProduction && status >= 500) {
            // Production + 5xx: không leak bất kỳ thông tin nội bộ nào
            normalizedResponse = {
                message: 'Internal server error',
            }
        } else {
            const exceptionResponse =
                exception instanceof HttpException
                    ? exception.getResponse()
                    : {
                          message: exception instanceof Error ? exception.message : 'Internal server error',
                      }

            normalizedResponse =
                typeof exceptionResponse === 'object' && exceptionResponse !== null
                    ? exceptionResponse
                    : {
                          message: String(exceptionResponse),
                      }
        }

        response.status(status).json(
            snakeCaseKeys({
                ...normalizedResponse,
                statusCode: status,
                path: request.originalUrl,
                timestamp: new Date().toISOString(),
            }),
        )
    }

    private getHttpStatus(exception: Error): number {
        if (exception instanceof jwt.TokenExpiredError) {
            return HttpStatus.UNAUTHORIZED
        }

        if (exception instanceof HttpException) {
            return exception.getStatus()
        }

        return HttpStatus.INTERNAL_SERVER_ERROR
    }
}
