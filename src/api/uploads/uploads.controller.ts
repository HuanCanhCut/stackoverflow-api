import { Body, Controller, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common'

import { GetS3PresignedUrlDto } from './dto/get-presigned-url.dto.js'
import { UploadsService } from './uploads.service.js'

import type { IRequest } from '~/type.js'

@Controller('uploads/s3')
export class UploadsController {
    constructor(private readonly uploadsService: UploadsService) {}

    @Post('presigned-url')
    @HttpCode(HttpStatus.OK)
    async getUploadPresignedUrl(@Body() body: GetS3PresignedUrlDto, @Req() req: IRequest) {
        const { files } = body

        const decoded = req.decoded

        if (!decoded) {
            throw new UnauthorizedException({ message: 'Unauthorized' })
        }

        const presignedUrls = await this.uploadsService.getUploadPresignedUrl({
            files,
            currentUserId: decoded.sub,
        })

        return presignedUrls
    }
}
