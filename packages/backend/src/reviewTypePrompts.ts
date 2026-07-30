import type { PromptContext } from './schemas.ts';
import {
    getAseMessagePart,
    getAseSystemPrompt,
    getOverallAnalysisSystemPrompt,
    getOverallDetailedAnalysisMessagePart,
    getOverallGeneralAnalysisMessagePart,
    getReviewMessagePart,
    getReviewSystemPrompt,
} from './prompts.ts';

export const REVIEW_TYPES = [
    'thesis-analysis',
    'thesis-analysis-detailed',
    'analysis',
    'analysis-detailed',
    'review-critical',
    'review',
    'review-guardian',
    'ase-review-critical',
    'ase-review',
    'ase-review-guardian',
] as const;

export type ReviewType = (typeof REVIEW_TYPES)[number];

export interface PromptBundle {
    systemPrompt: string;
    messagePart: string;
}

export function buildThesisAnalysisPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getOverallAnalysisSystemPrompt(body, 'thesis'),
        messagePart: getOverallGeneralAnalysisMessagePart(body, 'thesis').text,
    };
}

export function buildThesisAnalysisDetailedPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getOverallAnalysisSystemPrompt(body, 'thesis'),
        messagePart: getOverallDetailedAnalysisMessagePart(body, 'thesis').text,
    };
}

export function buildAnalysisPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getOverallAnalysisSystemPrompt(body, 'paper'),
        messagePart: getOverallGeneralAnalysisMessagePart(body, 'paper').text,
    };
}

export function buildAnalysisDetailedPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getOverallAnalysisSystemPrompt(body, 'paper'),
        messagePart: getOverallDetailedAnalysisMessagePart(body, 'paper').text,
    };
}

export function buildReviewCriticalPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getReviewSystemPrompt(body, 'critical'),
        messagePart: getReviewMessagePart(body).text,
    };
}

export function buildReviewPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getReviewSystemPrompt(body, 'default'),
        messagePart: getReviewMessagePart(body).text,
    };
}

export function buildReviewGuardianPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getReviewSystemPrompt(body, 'guardian'),
        messagePart: getReviewMessagePart(body).text,
    };
}

export function buildAseReviewCriticalPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getAseSystemPrompt(body, 'critical'),
        messagePart: getAseMessagePart().text,
    };
}

export function buildAseReviewPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getAseSystemPrompt(body, 'default'),
        messagePart: getAseMessagePart().text,
    };
}

export function buildAseReviewGuardianPrompt(body: PromptContext): PromptBundle {
    return {
        systemPrompt: getAseSystemPrompt(body, 'guardian'),
        messagePart: getAseMessagePart().text,
    };
}
