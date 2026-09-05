import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule, ObserveInstrument } from './app.module.js'

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        instrument: ObserveInstrument,
    })

    // format validation error to snake case
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,

            exceptionFactory(errors) {
                return new BadRequestException({
                    code: 'VALIDATION_ERROR',

                    errors: errors.map((error) => ({
                        field: error.property,
                        messages: Object.values(error.constraints ?? {}),
                    })),
                })
            },
        }),
    )

    app.setGlobalPrefix('api')

    await app.listen(process.env.PORT ?? 8000)
}

await bootstrap()
