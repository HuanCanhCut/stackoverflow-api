import type { ExecutionContext } from '@nestjs/common'

import type { PrismaService } from '../../config/prisma/prisma.service.js'
import type { IRequest } from '../../type.js'
import { AdminGuard } from './admin.guard.js'

describe('AdminGuard', () => {
    const findUnique = vi.fn()
    const guard = new AdminGuard({ user: { findUnique } } as unknown as PrismaService)

    const contextFor = (decoded?: IRequest['decoded']) =>
        ({
            switchToHttp: () => ({ getRequest: () => ({ decoded }) }),
        }) as ExecutionContext

    beforeEach(() => {
        findUnique.mockReset()
    })

    it('rejects a request without a decoded token', async () => {
        await expect(guard.canActivate(contextFor())).rejects.toMatchObject({
            response: { code: 'ADMIN_REQUIRED' },
        })
        expect(findUnique).not.toHaveBeenCalled()
    })

    it.each([
        ['a missing user', null],
        ['a normal user', { role: 'user', is_blocked: false }],
        ['a blocked admin', { role: 'admin', is_blocked: true }],
    ])('rejects %s', async (_, user) => {
        findUnique.mockResolvedValue(user)

        await expect(guard.canActivate(contextFor({ sub: 1 } as IRequest['decoded']))).rejects.toMatchObject({
            response: { code: 'ADMIN_REQUIRED' },
        })
    })

    it('allows an active admin', async () => {
        findUnique.mockResolvedValue({ role: 'admin', is_blocked: false })

        await expect(guard.canActivate(contextFor({ sub: 1 } as IRequest['decoded']))).resolves.toBe(true)
        expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }))
    })
})
