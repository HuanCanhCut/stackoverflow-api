export const snakeCaseKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(snakeCaseKeys)
    }

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, val]) => [toSnakeCase(key), snakeCaseKeys(val)]))
    }

    return value
}

const toSnakeCase = (value: string) =>
    value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase()
