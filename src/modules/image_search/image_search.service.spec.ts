import { parseImageSearchResult } from './image_search.service.js'

describe('parseImageSearchResult', () => {
    it('parses a plain JSON response', () => {
        expect(parseImageSearchResult('{"text": "TypeError: x is undefined", "query": "TypeError undefined"}')).toEqual(
            {
                query: 'TypeError undefined',
                extracted_text: 'TypeError: x is undefined',
            },
        )
    })

    it('extracts JSON wrapped in a markdown code fence and collapses whitespace in query', () => {
        const text = '```json\n{"text": "ModuleNotFoundError", "query": "  ModuleNotFoundError\\n  numpy "}\n```'

        expect(parseImageSearchResult(text)).toEqual({
            query: 'ModuleNotFoundError numpy',
            extracted_text: 'ModuleNotFoundError',
        })
    })

    it('returns empty query when fields are missing or not strings', () => {
        expect(parseImageSearchResult('{"text": 1}')).toEqual({ query: '', extracted_text: '' })
    })

    it('throws when the response is not JSON', () => {
        expect(() => parseImageSearchResult('Xin lỗi, tôi không đọc được ảnh')).toThrow()
    })
})
