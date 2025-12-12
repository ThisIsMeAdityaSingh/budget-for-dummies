import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../src/utils/index';

describe('sanitizeText', () => {
    it('should allow valid expense text', () => {
        const text = "Spent 500 on lunch";
        const result = sanitizeText(text);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedText).toBe(text);
    });

    it('should allow text with dates (hyphens)', () => {
        const text = "Paid 1000 on 2023-10-27";
        const result = sanitizeText(text);
        expect(result.isValid).toBe(true);
    });

    it('should allow text with times (colons)', () => {
        const text = "Lunch at 12:30 pm";
        const result = sanitizeText(text);
        expect(result.isValid).toBe(true);
    });

    it('should allow positive/negative numbers', () => {
        const text = "Received +1000 and spent -500";
        const result = sanitizeText(text);
        expect(result.isValid).toBe(true);
    });

    it('should reject dangerous characters', () => {
        const text = "Drop table users;";
        const result = sanitizeText(text);
        // Semicolon is not in the allowed list: . , ! ? - : +
        // wait, ; is not allowed. 
        expect(result.isValid).toBe(false);
    });

    it('should reject html tags', () => {
        const text = "Spent <b>500</b>";
        const result = sanitizeText(text);
        expect(result.isValid).toBe(false);
    });

    it('should reject too short text', () => {
        const text = "Hi";
        const result = sanitizeText(text);
        expect(result.isValid).toBe(false);
    });

    it('should allow text with all allowed special chars', () => {
        const text = "A1. B2, C3! D4? E5- F6: G7+";
        const result = sanitizeText(text);
        expect(result.isValid).toBe(true);
    });
});
