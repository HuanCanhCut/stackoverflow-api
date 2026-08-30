import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) {}

    async getUserById(id: number) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        })
        return user
    }
}
