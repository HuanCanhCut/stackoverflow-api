import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { TracerService } from '@nestjs/observe'
import type { Request, Response } from 'express'

import { snakeCaseKeys } from '../utils/object.util.js'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(private readonly tracerService: TracerService) {}

    async catch(exception: Error, host: ArgumentsHost) {
        const ctx = host.switchToHttp()

        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()

        const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

        // Observe vẫn nhận lỗi thật
        if (status >= 500) {
            await this.tracerService.captureError(exception, {
                method: request.method,
                path: request.originalUrl,
                status_code: String(status),
            })
        }

        const isProduction = process.env.NODE_ENV === 'production'

        let normalizedResponse

        // Production + 5xx: không leak bất kỳ thông tin nội bộ nào
        if (isProduction && status >= 500) {
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
}
