import { Request } from 'express'

export interface JwtPayload {
    sub: number
    jti: string
    iat: number
    exp: number
}

export interface IRequest extends Request {
    decoded: JwtPayload
}
