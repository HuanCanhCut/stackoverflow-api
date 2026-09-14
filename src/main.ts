import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { cert, initializeApp } from 'firebase-admin/app'
import helmet from 'helmet'

import { AppModule, ObserveInstrument } from '~/app.module.js'

initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
})

const flattenValidationErrors = (
    errors: ValidationError[],
    parentPath = '',
): {
    field: string
    messages: string[]
}[] => {
    return errors.flatMap((error) => {
        const field = parentPath ? `${parentPath}.${error.property}` : error.property

        const currentErrors = error.constraints
            ? [
                  {
                      field,
                      messages: Object.values(error.constraints),
                  },
              ]
            : []

        const childErrors = error.children?.length ? flattenValidationErrors(error.children, field) : []

        return [...currentErrors, ...childErrors]
    })
}

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        instrument: ObserveInstrument,
    })

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            exceptionFactory(errors) {
                return new BadRequestException({
                    code: 'VALIDATION_ERROR',
                    errors: flattenValidationErrors(errors),
                })
            },
        }),
    )

    app.setGlobalPrefix('api')

    app.set('trust proxy', 'loopback')

    app.use(helmet())

    await app.listen(process.env.PORT ?? 8000)
}

await bootstrap()
