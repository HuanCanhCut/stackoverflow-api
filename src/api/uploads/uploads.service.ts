import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Redis } from 'ioredis'

import type { GetS3PresignedUrlDto } from './dto/get-presigned-url.dto.js'

import { S3Service } from '~/config/s3/s3.service.js'
import { S3ContentType, S3Folder } from '~/types/s3.type.js'

@Injectable()
export class UploadsService {
    constructor(
        private readonly redis: Redis,
        private readonly s3Service: S3Service,
    ) {}

    async getUploadPresignedUrl({
        files,
        currentUserId,
    }: {
        files: GetS3PresignedUrlDto['files']
        currentUserId: number
    }) {
        const extMap: Record<S3ContentType, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
        }

        const promises = files.map(async ({ folder, content_type }) => {
            const ext = extMap[content_type]
            const key = `${folder}/${currentUserId}-${crypto.randomUUID()}.${ext}`

            const putPresignedUrl = await getSignedUrl(
                this.s3Service.s3,
                new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: key,
                    ContentType: content_type,
                }),
                { expiresIn: Number(process.env.S3_PRESIGNED_URL_EXP) },
            )

            const uploadId = crypto.randomUUID()

            await this.redis.set(
                `s3_upload_id:${uploadId}`,
                JSON.stringify({
                    user_id: currentUserId,
                    object_key: key,
                    folder,
                }),
                'EX',
                Number(process.env.S3_PRESIGNED_URL_EXP),
            )

            return {
                presigned_url: putPresignedUrl,
                upload_id: uploadId,
            }
        })

        return Promise.all(promises)
    }

    async verifyUploadId({
        uploadId,
        currentUserId,
        folder,
    }: {
        uploadId: string
        currentUserId: string
        folder: S3Folder
    }) {
        const uploadCache = await this.redis.get(`s3_upload_id:${uploadId}`)

        const uploadInfo = JSON.parse(uploadCache || '{}')

        if (!uploadInfo) {
            throw new BadRequestException({ message: 'Invalid or expired upload ID' })
        }

        if (uploadInfo.user_id !== currentUserId) {
            throw new BadRequestException({ message: 'Unauthorized access to upload ID' })
        }

        if (uploadInfo.folder !== folder) {
            throw new BadRequestException({ message: 'Invalid upload directory' })
        }

        // check file exist in s3 bucket
        try {
            await this.s3Service.s3.send(
                new HeadObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: uploadInfo.object_key,
                }),
            )
        } catch (_) {
            throw new NotFoundException({ message: 'File not found on s3 bucket' })
        }

        return uploadInfo.object_key
    }
}
