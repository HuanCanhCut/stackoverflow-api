import { parseModerationResult } from './moderation.service.js'

describe('parseModerationResult', () => {
    it('parses a plain JSON response', () => {
        expect(parseModerationResult('{"violated": false, "categories": [], "reason": ""}')).toEqual({
            violated: false,
            categories: [],
            reason: '',
        })
    })

    it('extracts JSON wrapped in a markdown code fence', () => {
        const text = '```json\n{"violated": true, "categories": ["politics"], "reason": "Nội dung chính trị"}\n```'

        expect(parseModerationResult(text)).toEqual({
            violated: true,
            categories: ['politics'],
            reason: 'Nội dung chính trị',
        })
    })

    it('drops unknown categories and fills a default reason when violated', () => {
        expect(parseModerationResult('{"violated": true, "categories": ["indecent", "spam"], "reason": ""}')).toEqual({
            violated: true,
            categories: ['indecent'],
            reason: 'Nội dung vi phạm tiêu chuẩn cộng đồng.',
        })
    })

    it('throws when the response has no usable verdict', () => {
        expect(() => parseModerationResult('Tôi không thể trả lời')).toThrow()
        expect(() => parseModerationResult('{"categories": []}')).toThrow()
    })
})
