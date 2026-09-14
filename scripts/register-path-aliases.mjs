import { register } from 'node:module'

register('./path-aliases.loader.mjs', import.meta.url)
