import { Module } from '@nestjs/common'

import { ImageSearchService } from './image_search.service.js'

@Module({
    providers: [ImageSearchService],
    exports: [ImageSearchService],
})
export class ImageSearchModule {}
