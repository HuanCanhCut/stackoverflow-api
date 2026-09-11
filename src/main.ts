import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { cert, initializeApp } from 'firebase-admin/app'

import { AppModule, ObserveInstrument } from './app.module.js'

initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
})

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
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
    app.set('trust proxy', 'loopback') // Trust requests from the loopback address

    await app.listen(process.env.PORT ?? 8000)
}

await bootstrap()
