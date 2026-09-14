import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import type { Request, Response } from 'express'
import pc from 'picocolors'
import type { Observable } from 'rxjs'

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP')

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') {
            return next.handle()
        }

        const request = context.switchToHttp().getRequest<Request>()
        const response = context.switchToHttp().getResponse<Response>()

        const start = performance.now()

        response.once('finish', () => {
            const duration = performance.now() - start

            const method = this.colorMethod(request.method)
            const status = this.colorStatus(response.statusCode)
            const time = this.colorDuration(duration)

            this.logger.log(`${method} ${request.originalUrl} ${status} ${time}`)
        })

        return next.handle()
    }

    private colorMethod(method: string) {
        switch (method) {
            case 'GET':
                return pc.cyan(method)

            case 'POST':
                return pc.green(method)

            case 'PUT':
            case 'PATCH':
                return pc.yellow(method)

            case 'DELETE':
                return pc.red(method)

            default:
                return pc.white(method)
        }
    }

    private colorStatus(status: number) {
        const value = String(status)

        if (status >= 500) {
            return pc.red(value)
        }

        if (status >= 400) {
            return pc.yellow(value)
        }

        if (status >= 300) {
            return pc.cyan(value)
        }

        if (status >= 200) {
            return pc.green(value)
        }

        return pc.white(value)
    }

    private colorDuration(duration: number) {
        const value = `${duration.toFixed(2)}ms`

        if (duration >= 1000) {
            return pc.red(value)
        }

        if (duration >= 300) {
            return pc.yellow(value)
        }

        return pc.green(value)
    }
}
