import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, ValidateNested } from 'class-validator'

import { S3ContentType, S3Folder } from '~/types/s3.type.js'

class S3PresignedFileDto {
    @IsEnum(S3Folder, {
        message: `Folder không hợp lệ, chỉ chấp nhận: ${Object.values(S3Folder).join(', ')}`,
    })
    folder: S3Folder

    @IsEnum(S3ContentType, {
        message: `Chỉ chấp nhận các định dạng file: ${Object.values(S3ContentType).join(', ')}`,
    })
    content_type: S3ContentType
}

export class GetS3PresignedUrlDto {
    @IsArray()
    @ArrayMinSize(1, {
        message: 'Phải có ít nhất 1 file để upload',
    })
    @ArrayMaxSize(10, {
        message: 'Không được upload quá 10 file cùng lúc',
    })
    @ValidateNested({ each: true })
    @Type(() => S3PresignedFileDto)
    files: S3PresignedFileDto[]
}
