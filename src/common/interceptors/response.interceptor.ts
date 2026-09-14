import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { Observable } from 'rxjs'
import { map } from 'rxjs'

import { RESPONSE_TYPE_METADATA, ResponseType } from '../response/response.constants.js'
import type {
    ApiResponse,
    CursorPaginationInput,
    CursorPaginationResponse,
    PagePaginationInput,
    PagePaginationResponse,
} from '../response/response.types.js'

type ResponseRequest = Pick<Request, 'get' | 'originalUrl' | 'protocol'>
type RecordValue = Record<string, unknown>

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') {
            return next.handle()
        }

        const responseType =
            this.reflector.getAllAndOverride<ResponseType>(RESPONSE_TYPE_METADATA, [
                context.getHandler(),
                context.getClass(),
            ]) ?? ResponseType.Default
        const request = context.switchToHttp().getRequest<ResponseRequest>()

        return next.handle().pipe(map((value: unknown) => this.transform(value, responseType, request)))
    }

    private transform(value: unknown, responseType: ResponseType, request: ResponseRequest): unknown {
        if (this.isApiResponse(value)) {
            return value
        }

        switch (responseType) {
            case ResponseType.Pagination:
                return this.toPagePaginationResponse(value, request)

            case ResponseType.CursorPagination:
                return this.toCursorPaginationResponse(value, request)

            case ResponseType.Default:
                return this.toDefaultResponse(value)
        }
    }

    private toDefaultResponse(value: unknown): ApiResponse {
        return {
            data: value ?? null,
            meta: null,
        }
    }

    private toPagePaginationResponse(value: unknown, request: ResponseRequest): PagePaginationResponse | ApiResponse {
        if (!this.isPagePaginationInput(value)) {
            return this.toDefaultResponse(value)
        }

        const { data, total, count, current_page, per_page, ...additionalMeta } = value
        const totalPages = per_page > 0 ? Math.ceil(total / per_page) : 0
        const hasPreviousPage = current_page > 1 && totalPages > 0

        return {
            data: data ?? null,
            meta: {
                ...additionalMeta,
                pagination: {
                    total,
                    count,
                    total_pages: totalPages,
                    current_page,
                    per_page,
                },
                links: {
                    prev: hasPreviousPage
                        ? this.buildUrl(request, {
                              page: Math.min(current_page - 1, totalPages),
                              per_page,
                          })
                        : null,
                    next:
                        current_page < totalPages
                            ? this.buildUrl(request, {
                                  page: current_page + 1,
                                  per_page,
                              })
                            : null,
                },
            },
        }
    }

    private toCursorPaginationResponse(
        value: unknown,
        request: ResponseRequest,
    ): CursorPaginationResponse | ApiResponse {
        if (!this.isCursorPaginationInput(value)) {
            return this.toDefaultResponse(value)
        }

        const { data, limit, next_cursor, ...additionalMeta } = value
        const nextCursor = next_cursor ?? null

        return {
            data: data ?? null,
            meta: {
                ...additionalMeta,
                pagination: {
                    limit,
                    has_next_page: nextCursor !== null,
                    next_cursor: nextCursor,
                },
                links: {
                    next:
                        nextCursor !== null
                            ? this.buildUrl(request, {
                                  cursor: nextCursor,
                                  limit,
                              })
                            : null,
                },
            },
        }
    }

    private buildUrl(request: ResponseRequest, query: Record<string, number | string>): string {
        const [path, rawQuery = ''] = request.originalUrl.split('?', 2)
        const searchParams = new URLSearchParams(rawQuery)

        for (const [key, value] of Object.entries(query)) {
            searchParams.set(key, String(value))
        }

        const host = request.get('host')
        const baseUrl = host ? `${request.protocol}://${host}${path}` : path
        const queryString = searchParams.toString()

        return queryString ? `${baseUrl}?${queryString}` : baseUrl
    }

    private isApiResponse(value: unknown): value is ApiResponse {
        return this.isRecord(value) && Object.hasOwn(value, 'data') && Object.hasOwn(value, 'meta')
    }

    private isPagePaginationInput(value: unknown): value is PagePaginationInput {
        return (
            this.isRecord(value) &&
            Object.hasOwn(value, 'data') &&
            this.isFiniteNumber(value.total) &&
            this.isFiniteNumber(value.count) &&
            this.isFiniteNumber(value.current_page) &&
            this.isFiniteNumber(value.per_page)
        )
    }

    private isCursorPaginationInput(value: unknown): value is CursorPaginationInput {
        return (
            this.isRecord(value) &&
            Object.hasOwn(value, 'data') &&
            this.isFiniteNumber(value.limit) &&
            (value.next_cursor === undefined || value.next_cursor === null || typeof value.next_cursor === 'string')
        )
    }

    private isRecord(value: unknown): value is RecordValue {
        return typeof value === 'object' && value !== null
    }

    private isFiniteNumber(value: unknown): value is number {
        return typeof value === 'number' && Number.isFinite(value)
    }
}
