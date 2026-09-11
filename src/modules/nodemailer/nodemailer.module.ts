import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter'

@Module({
    imports: [
        ConfigModule,

        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                transport: {
                    host: 'smtp.gmail.com',
                    port: 587,
                    auth: {
                        user: configService.get<string>('NODE_MAILER_EMAIL'),
                        pass: configService.get<string>('NODE_MAILER_PASSWORD'),
                    },
                },

                defaults: {
                    from: `"No Reply" <${configService.get<string>('NODE_MAILER_EMAIL')}>`,
                },

                template: {
                    adapter: new HandlebarsAdapter(),
                },
            }),
        }),
    ],
})
export class NodemailerModule {}
