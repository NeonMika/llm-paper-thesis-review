import { describe, it, expect } from 'bun:test';
import { getModelFromBody, normalizePrompt, pro, flash } from '../utils/model';

describe('normalizePrompt', () => {
    it('returns undefined for undefined', () => {
        expect(normalizePrompt(undefined)).toBeUndefined();
    });

    it('returns undefined for null', () => {
        expect(normalizePrompt(null)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
        expect(normalizePrompt('')).toBeUndefined();
    });

    it('returns undefined for whitespace-only string', () => {
        expect(normalizePrompt('   ')).toBeUndefined();
    });

    it('returns undefined for the string "undefined"', () => {
        expect(normalizePrompt('undefined')).toBeUndefined();
    });

    it('returns undefined for the string "null"', () => {
        expect(normalizePrompt('null')).toBeUndefined();
    });

    it('returns the value unchanged for a valid string', () => {
        expect(normalizePrompt('hello world')).toBe('hello world');
    });

    it('returns the value without trimming when trimmed form is non-empty', () => {
        expect(normalizePrompt('  hello  ')).toBe('  hello  ');
    });
});

describe('getModelFromBody', () => {
    it('returns pro model identifier for model="pro"', () => {
        expect(getModelFromBody({ model: 'pro' })).toBe(pro);
    });

    it('returns flash model identifier for model="flash"', () => {
        expect(getModelFromBody({ model: 'flash' })).toBe(flash);
    });

    it('defaults to flash for undefined model', () => {
        expect(getModelFromBody({})).toBe(flash);
    });
});

describe('pro and flash constants', () => {
    it('pro is the expected Gemini Pro model identifier', () => {
        expect(pro).toBe('gemini-3-pro-preview');
    });

    it('flash is the expected Gemini Flash model identifier', () => {
        expect(flash).toBe('gemini-3-flash-preview');
    });

    it('pro and flash are different values', () => {
        expect(pro).not.toBe(flash);
    });
});
