import { splitSearchTerms } from './questions.service.js'

describe('splitSearchTerms', () => {
    it('splits by whitespace, strips surrounding punctuation and lowercases', () => {
        expect(splitSearchTerms("TypeError: Cannot read properties of undefined (reading 'map')")).toEqual([
            'typeerror',
            'cannot',
            'read',
            'properties',
            'of',
            'undefined',
            'reading',
            'map',
        ])
    })

    it('keeps symbols that are part of a keyword', () => {
        expect(splitSearchTerms('c++ c# node.js.')).toEqual(['c++', 'c#', 'node.js'])
    })

    it('removes duplicates and limits the number of terms', () => {
        expect(splitSearchTerms('a A b c d e f g h i j k l')).toEqual([
            'a',
            'b',
            'c',
            'd',
            'e',
            'f',
            'g',
            'h',
            'i',
            'j',
        ])
    })

    it('falls back to the raw search when it only contains punctuation', () => {
        expect(splitSearchTerms('{}')).toEqual(['{}'])
    })
})
