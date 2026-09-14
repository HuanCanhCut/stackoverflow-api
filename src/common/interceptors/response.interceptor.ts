import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'
import { map } from 'rxjs'

import {
    RESPONSE_STATUS_BY_CODE,
    RESPONSE_STATUS_METADATA,
    RESPONSE_TYPE_METADATA,
    type MappedResponseStatus,
    ResponseType,
} from '../response/response.constants.js'
import type {
    ApiResponse,
    CursorPaginationInput,
    CursorPaginationResponse,
    PagePaginationInput,
    PagePaginationResponse,
} from '../response/response.types.js'

type ResponseRequest = Pick<Request, 'get' | 'originalUrl' | 'protocol'>
type RecordValue = Record<string, unknown>
type ExistingApiResponse = RecordValue & {
    data: unknown
    meta?: unknown
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') {
            return next.handle()
        }

        const metadataTargets = [context.getHandler(), context.getClass()]
        const responseType =
            this.reflector.getAllAndOverride<ResponseType>(RESPONSE_TYPE_METADATA, metadataTargets) ??
            ResponseType.Default
        const responseStatus = this.reflector.getAllAndOverride<string>(RESPONSE_STATUS_METADATA, metadataTargets)
        const request = context.switchToHttp().getRequest<ResponseRequest>()
        const response = context.switchToHttp().getResponse<Pick<Response, 'statusCode'>>()

        return next
            .handle()
            .pipe(
                map((value: unknown) =>
                    this.transform(value, responseType, request, response.statusCode, responseStatus),
                ),
            )
    }

    private transform(
        value: unknown,
        responseType: ResponseType,
        request: ResponseRequest,
        statusCode: number,
        responseStatus?: string,
    ): unknown {
        const status = responseStatus ?? this.getResponseStatus(statusCode)

        if (this.isApiResponse(value)) {
            return this.normalizeApiResponse(value, statusCode, status)
        }

        switch (responseType) {
            case ResponseType.Pagination:
                return this.toPagePaginationResponse(value, request, statusCode, status)

            case ResponseType.CursorPagination:
                return this.toCursorPaginationResponse(value, request, statusCode, status)

            case ResponseType.Default:
                return this.toDefaultResponse(value, statusCode, status)
        }
    }

    private toDefaultResponse(value: unknown, statusCode: number, status: string): ApiResponse {
        return {
            data: value ?? null,
            status_code: statusCode,
            status,
        }
    }

    private toPagePaginationResponse(
        value: unknown,
        request: ResponseRequest,
        statusCode: number,
        status: string,
    ): PagePaginationResponse | ApiResponse {
        if (!this.isPagePaginationInput(value)) {
            return this.toDefaultResponse(value, statusCode, status)
        }

        const { data, total, count, current_page, per_page, ...additionalMeta } = value
        const totalPages = per_page > 0 ? Math.ceil(total / per_page) : 0
        const hasPreviousPage = current_page > 1 && totalPages > 0

        return {
            data: data ?? null,
            status_code: statusCode,
            status,
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
        statusCode: number,
        status: string,
    ): CursorPaginationResponse | ApiResponse {
        if (!this.isCursorPaginationInput(value)) {
            return this.toDefaultResponse(value, statusCode, status)
        }

        const { data, limit, next_cursor, ...additionalMeta } = value
        const nextCursor = next_cursor ?? null

        return {
            data: data ?? null,
            status_code: statusCode,
            status,
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

    private isApiResponse(value: unknown): value is ExistingApiResponse {
        return (
            this.isRecord(value) &&
            Object.hasOwn(value, 'data') &&
            (Object.hasOwn(value, 'meta') ||
                (typeof value.status === 'string' && this.isFiniteNumber(value.status_code)))
        )
    }

    private normalizeApiResponse(
        value: ExistingApiResponse,
        statusCode: number,
        status: string,
    ): ApiResponse<unknown, unknown> {
        const { meta, ...response } = value

        return {
            ...response,
            data: value.data ?? null,
            status_code: statusCode,
            status,
            ...(meta !== null && meta !== undefined ? { meta } : {}),
        }
    }

    private getResponseStatus(statusCode: number): MappedResponseStatus {
        return RESPONSE_STATUS_BY_CODE[statusCode] ?? 'success'
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
