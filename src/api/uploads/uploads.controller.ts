import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'

import { AuthGuard } from '../../common/guards/auth.guard.js'
import { GetS3PresignedUrlDto } from './dto/get-presigned-url.dto.js'
import { UploadsService } from './uploads.service.js'

import type { IRequest } from '~/type.js'

@Controller('uploads/s3')
export class UploadsController {
    constructor(private readonly uploadsService: UploadsService) {}

    @Post('presigned-url')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard)
    async getUploadPresignedUrl(@Body() body: GetS3PresignedUrlDto, @Req() req: IRequest) {
        const { files } = body

        const presignedUrls = await this.uploadsService.getUploadPresignedUrl({
            files,
            currentUserId: req.decoded.sub,
        })

        return presignedUrls
    }
}
