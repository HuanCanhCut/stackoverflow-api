export const RESPONSE_TYPE_METADATA = 'response:type' as const

export enum ResponseType {
    Default = 'default',
    Pagination = 'pagination',
    CursorPagination = 'cursor-pagination',
}
