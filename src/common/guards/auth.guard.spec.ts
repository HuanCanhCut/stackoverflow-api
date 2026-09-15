import type { ExecutionContext } from '@nestjs/common'
import type { Redis } from 'ioredis'
import jwt from 'jsonwebtoken'

import type { IRequest } from '../../type.js'
import { AuthGuard } from './auth.guard.js'

describe('AuthGuard', () => {
    const secret = 'auth-guard-test-secret'
    const originalSecret = process.env.JWT_SECRET
    const redis = { get: vi.fn() }
    const guard = new AuthGuard(redis as unknown as Redis)

    const contextFor = (authorization?: string) => {
        const req = { headers: { authorization } } as IRequest
        const context = {
            switchToHttp: () => ({ getRequest: () => req }),
        } as ExecutionContext

        return { req, context }
    }

    beforeEach(() => {
        process.env.JWT_SECRET = secret
        redis.get.mockReset()
        redis.get.mockResolvedValue(null)
    })

    afterAll(() => {
        if (originalSecret === undefined) {
            delete process.env.JWT_SECRET
        } else {
            process.env.JWT_SECRET = originalSecret
        }
    })

    it('requires a Bearer access token', async () => {
        for (const authorization of [undefined, 'Basic abc', 'Bearer']) {
            const { context } = contextFor(authorization)

            await expect(guard.canActivate(context)).rejects.toMatchObject({
                response: { code: 'ACCESS_TOKEN_REQUIRED' },
            })
        }

        expect(redis.get).not.toHaveBeenCalled()
    })

    it('rejects a revoked token before attaching its payload', async () => {
        const token = jwt.sign({ sub: 42 }, secret)
        const { req, context } = contextFor(`Bearer ${token}`)
        redis.get.mockResolvedValue('revoked')

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            response: { code: 'TOKEN_REVOKED' },
        })
        expect(redis.get).toHaveBeenCalledWith(`access_token:${token}`)
        expect(req.decoded).toBeUndefined()
    })

    it('rejects an invalid token', async () => {
        const { context } = contextFor('Bearer invalid-token')

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            response: { code: 'TOKEN_VERIFICATION_FAILED' },
        })
    })

    it('lets an expired token error reach the global exception filter', async () => {
        const token = jwt.sign({ sub: 42, exp: 1 }, secret)
        const { context } = contextFor(`Bearer ${token}`)

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(jwt.TokenExpiredError)
    })

    it('attaches the decoded payload for a valid token', async () => {
        const token = jwt.sign({ sub: 42, jti: 'token-id' }, secret)
        const { req, context } = contextFor(`Bearer ${token}`)

        await expect(guard.canActivate(context)).resolves.toBe(true)
        expect(req.decoded).toMatchObject({ sub: 42, jti: 'token-id' })
    })
})
