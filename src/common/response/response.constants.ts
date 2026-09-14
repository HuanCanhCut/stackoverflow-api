export const RESPONSE_TYPE_METADATA = 'response:type' as const
export const RESPONSE_STATUS_METADATA = 'response:status' as const

export type MappedResponseStatus =
    | 'ok'
    | 'created'
    | 'accepted'
    | 'non_authoritative_information'
    | 'no_content'
    | 'reset_content'
    | 'partial_content'
    | 'multi_status'
    | 'already_reported'
    | 'im_used'
    | 'success'

export const RESPONSE_STATUS_BY_CODE: Readonly<Partial<Record<number, MappedResponseStatus>>> = {
    200: 'ok',
    201: 'created',
    202: 'accepted',
    203: 'non_authoritative_information',
    204: 'no_content',
    205: 'reset_content',
    206: 'partial_content',
    207: 'multi_status',
    208: 'already_reported',
    226: 'im_used',
}

export enum ResponseType {
    Default = 'default',
    Pagination = 'pagination',
    CursorPagination = 'cursor-pagination',
}
