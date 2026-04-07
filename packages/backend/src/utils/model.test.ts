import { describe, it, expect } from 'bun:test';
import { google, getModelFromBody, normalizePrompt, pro, flash } from '../utils/model';

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

    it('preserves internal whitespace', () => {
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
    it('pro is a non-empty string', () => {
        expect(typeof pro).toBe('string');
        expect(pro.length).toBeGreaterThan(0);
    });

    it('flash is a non-empty string', () => {
        expect(typeof flash).toBe('string');
        expect(flash.length).toBeGreaterThan(0);
    });

    it('pro and flash are different values', () => {
        expect(pro).not.toBe(flash);
    });
});
