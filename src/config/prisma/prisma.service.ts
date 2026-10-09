import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../../generated/prisma/client.js'

export const createBasePrisma = () => {
    const adapter = new PrismaMariaDb({
        host: process.env.DATABASE_HOST!,
        port: Number(process.env.DATABASE_PORT ?? 3306),
        user: process.env.DATABASE_USER!,
        password: process.env.DATABASE_PASSWORD!,
        database: process.env.DATABASE_NAME!,

        connectionLimit: 5,

        allowPublicKeyRetrieval: true,

        connectTimeout: 5_000,
        acquireTimeout: 10_000,
    })

    return new PrismaClient({
        adapter,
        omit: {
            user: {
                password: true,
                email: true,
                sign_in_provider: true,
                provider_uid: true,
            },
        },
    })
}

// DB chỉ lưu object key của file trên S3, khi trả ra thì nối thêm origin công khai (S3_PUBLIC_URL)
const toPublicUrl = (path: string | null) => {
    if (!path) return null

    // URL ngoài (vd: ảnh đại diện Google/GitHub) đã đầy đủ, giữ nguyên
    if (/^https?:\/\//i.test(path)) return path

    const publicBaseUrl = (process.env.S3_PUBLIC_URL ?? '').replace(/\/+$/, '')

    return `${publicBaseUrl}/${path.replace(/^\/+/, '')}`
}

export const extendPrismaClient = (basePrisma: ReturnType<typeof createBasePrisma>) => {
    return basePrisma.$extends({
        result: {
            user: {
                full_name: {
                    needs: {
                        first_name: true,
                        last_name: true,
                    },
                    compute(user) {
                        return [user.first_name, user.last_name].filter(Boolean).join(' ') || null
                    },
                },
                avatar_path: {
                    needs: {
                        avatar_path: true,
                    },
                    compute(user) {
                        return toPublicUrl(user.avatar_path)
                    },
                },
            },
            questionAttachment: {
                url: {
                    needs: {
                        object_key: true,
                    },
                    compute(attachment) {
                        return toPublicUrl(attachment.object_key)
                    },
                },
            },
            messageAttachment: {
                url: {
                    needs: {
                        object_key: true,
                    },
                    compute(attachment) {
                        return toPublicUrl(attachment.object_key)
                    },
                },
            },
        },
    })
}

export type ExtendedPrismaClient = ReturnType<typeof extendPrismaClient>

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private readonly basePrisma: ReturnType<typeof createBasePrisma>
    private readonly extendedClient: ExtendedPrismaClient

    constructor() {
        this.basePrisma = createBasePrisma()
        this.extendedClient = extendPrismaClient(this.basePrisma)

        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if (prop in target) {
                    return Reflect.get(target, prop, receiver)
                }

                return Reflect.get(this.extendedClient, prop, this.extendedClient)
            },
        })
    }

    async onModuleInit() {
        await this.basePrisma.$connect()
    }

    async onModuleDestroy() {
        await this.basePrisma.$disconnect()
    }
}

export interface PrismaService extends ExtendedPrismaClient {}
