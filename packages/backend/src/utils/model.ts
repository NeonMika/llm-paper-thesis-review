/// <reference types="bun-types" />
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const pro = 'gemini-3.1-pro-preview';
export const flash = 'gemini-3.5-flash';

export function google(apiKey: string | null | undefined) {
    return createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
}

export function getModelFromBody(body: { model?: 'pro' | 'flash' }) {
    if (body.model === 'pro') return pro;
    return flash;
}

// Treat common placeholder values as absent so fallbacks work reliably
export function normalizePrompt(value: string | null | undefined): string | undefined {
    if (value === undefined || value === null) return undefined;
    const s = value.trim();
    if (s.length === 0) return undefined;
    const lower = s.toLowerCase();
    if (lower === 'undefined' || lower === 'null') return undefined;
    return value;
}
