import { Type } from 'class-transformer'
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsString,
    MaxLength,
    ValidateIf,
    ValidateNested,
} from 'class-validator'

export class TagDto {
    @ValidateIf((_, value) => value !== null)
    @IsInt({ message: 'ID của thẻ (tag) phải là số nguyên' })
    id: number | null

    @IsString({ message: 'Tên thẻ (tag) phải là chuỗi' })
    @IsNotEmpty({ message: 'Tên thẻ (tag) không được để trống' })
    @MaxLength(50, { message: 'Tên thẻ (tag) không được vượt quá 50 ký tự' })
    name: string
}

export class CreateQuestionDto {
    @IsString({ message: 'Tiêu đề phải là chuỗi' })
    @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
    @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự' })
    title: string

    @IsString({ message: 'Nội dung câu hỏi phải là chuỗi' })
    @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống' })
    body: string

    @IsArray({ message: 'Danh sách thẻ (tag) phải là một mảng' })
    @ArrayMaxSize(5, { message: 'Câu hỏi chỉ được gắn tối đa 5 thẻ (tag)' })
    @ArrayUnique((tag: TagDto) => tag.name?.toLowerCase(), { message: 'Các thẻ (tag) không được trùng nhau' })
    @ValidateNested({ each: true })
    @Type(() => TagDto)
    tags: TagDto[]
}
