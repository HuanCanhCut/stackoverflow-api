import { SetMetadata } from '@nestjs/common'

import { RESPONSE_STATUS_METADATA, RESPONSE_TYPE_METADATA, ResponseType } from './response.constants.js'

export const ResponseData = () => SetMetadata(RESPONSE_TYPE_METADATA, ResponseType.Default)

export const ResponsePagination = () => SetMetadata(RESPONSE_TYPE_METADATA, ResponseType.Pagination)

export const ResponseCursorPagination = () => SetMetadata(RESPONSE_TYPE_METADATA, ResponseType.CursorPagination)

export const ResponseStatus = (status: string) => SetMetadata(RESPONSE_STATUS_METADATA, status)
