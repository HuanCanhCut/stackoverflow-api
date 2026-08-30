import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
    @Get('/health-check')
    healthCheck(): { status: string } {
        return { status: 'ok' }
    }
}
