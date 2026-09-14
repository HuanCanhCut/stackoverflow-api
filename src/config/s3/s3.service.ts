import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

@Injectable()
export class S3Service implements OnModuleInit {
    private readonly logger = new Logger(S3Service.name)

    readonly s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: 'auto',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || 's3_access_key',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 's3_secret_access_key',
        },
    })

    private readonly bucketName = process.env.S3_BUCKET_NAME || 'h-nine-n'

    async onModuleInit() {
        console.log(process.env.S3_ENDPOINT)

        await this.initializeBucket()
    }

    private async initializeBucket() {
        try {
            await this.s3.send(
                new HeadBucketCommand({
                    Bucket: this.bucketName,
                }),
            )

            this.logger.log(`Bucket ${this.bucketName} already exists`)
        } catch {
            this.logger.warn(`Creating bucket ${this.bucketName}`)

            await this.s3.send(
                new CreateBucketCommand({
                    Bucket: this.bucketName,
                }),
            )

            this.logger.log(`Bucket ${this.bucketName} created successfully`)
        }
    }
}
