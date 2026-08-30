import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'

@Injectable()
export class AppService {
    getHello(): string {
        throw new Error('test error')
    }
}
