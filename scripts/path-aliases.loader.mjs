const sourceRoot = new URL('../dist/', import.meta.url)

export function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('~/')) {
        return nextResolve(new URL(specifier.slice(2), sourceRoot).href, context)
    }

    return nextResolve(specifier, context)
}
