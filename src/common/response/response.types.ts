export type AdditionalMeta = Record<string, unknown>

export interface ApiResponse<T = unknown, M = AdditionalMeta> {
    data: T | null
    status_code: number
    status: string
    meta?: M
}

export interface PagePaginationInput<T = unknown> extends AdditionalMeta {
    data: T
    total: number
    count: number
    current_page: number
    per_page: number
}

export interface CursorPaginationInput<T = unknown> extends AdditionalMeta {
    data: T
    limit: number
    next_cursor?: string | null
}

export interface PagePagination {
    total: number
    count: number
    total_pages: number
    current_page: number
    per_page: number
}

export interface CursorPagination {
    limit: number
    has_next_page: boolean
    next_cursor: string | null
}

export interface PaginationLinks {
    prev: string | null
    next: string | null
}

export interface CursorPaginationLinks {
    next: string | null
}

export interface PagePaginationMeta extends AdditionalMeta {
    pagination: PagePagination
    links: PaginationLinks
}

export interface CursorPaginationMeta extends AdditionalMeta {
    pagination: CursorPagination
    links: CursorPaginationLinks
}

export type PagePaginationResponse<T = unknown> = ApiResponse<T, PagePaginationMeta>

export type CursorPaginationResponse<T = unknown> = ApiResponse<T, CursorPaginationMeta>
