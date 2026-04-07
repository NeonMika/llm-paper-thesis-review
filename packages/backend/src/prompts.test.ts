import { describe, it, expect } from 'bun:test';
import {
    getOverallAnalysisSystemPrompt,
    getSectionAnalysisSystemPrompt,
    getSectionAnalysisMessagePart,
    getReviewSystemPrompt,
    getAseSystemPrompt,
    getSectionsSystemPrompt,
} from './prompts';
import type { AnalysisBody, SectionAnalysisBody, ReviewBody } from './schemas';

const baseAnalysisBody: AnalysisBody = {
    model: 'flash',
    file: new File([''], 'paper.pdf'),
    kind: 'full conference paper',
};

const baseSectionBody: SectionAnalysisBody = {
    model: 'flash',
    file: new File([''], 'paper.pdf'),
    kind: 'master thesis',
    sectionTitle: 'Introduction',
};

const baseReviewBody: ReviewBody = {
    model: 'flash',
    file: new File([''], 'paper.pdf'),
    kind: 'full conference paper',
};

describe('getOverallAnalysisSystemPrompt', () => {
    it('includes the paper kind', () => {
        const prompt = getOverallAnalysisSystemPrompt(baseAnalysisBody);
        expect(prompt).toContain('full conference paper');
    });

    it('mentions work in progress when workInProgress is true', () => {
        const prompt = getOverallAnalysisSystemPrompt({
            ...baseAnalysisBody,
            workInProgress: true,
        });
        expect(prompt).toContain('work in progress');
    });

    it('mentions completed work when workInProgress is false', () => {
        const prompt = getOverallAnalysisSystemPrompt({
            ...baseAnalysisBody,
            workInProgress: false,
        });
        expect(prompt).toContain('completed work');
    });

    it('includes page limit context when hasPageLimit is true', () => {
        const prompt = getOverallAnalysisSystemPrompt({
            ...baseAnalysisBody,
            hasPageLimit: true,
            pageLimit: '12',
            currentPages: '10',
        });
        expect(prompt).toContain('page limit of 12 pages');
        expect(prompt).toContain('currently has 10 pages');
    });

    it('does not include page limit when hasPageLimit is false', () => {
        const prompt = getOverallAnalysisSystemPrompt({
            ...baseAnalysisBody,
            hasPageLimit: false,
        });
        expect(prompt).toContain('does not have a page limit');
    });
});

describe('getSectionAnalysisSystemPrompt', () => {
    it('includes the section kind', () => {
        const prompt = getSectionAnalysisSystemPrompt(baseSectionBody);
        expect(prompt).toContain('master thesis');
    });

    it('mentions work in progress context when set', () => {
        const prompt = getSectionAnalysisSystemPrompt({
            ...baseSectionBody,
            workInProgress: true,
        });
        expect(prompt).toContain('work in progress');
    });
});

describe('getSectionAnalysisMessagePart', () => {
    it('includes the section title in the message', () => {
        const part = getSectionAnalysisMessagePart(baseSectionBody);
        expect(part.text).toContain('Introduction');
    });

    it('includes the kind in the message', () => {
        const part = getSectionAnalysisMessagePart(baseSectionBody);
        expect(part.text).toContain('master thesis');
    });

    it('returns a TextPart with type "text"', () => {
        const part = getSectionAnalysisMessagePart(baseSectionBody);
        expect(part.type).toBe('text');
    });
});

describe('getReviewSystemPrompt', () => {
    it('returns a non-empty string', () => {
        const prompt = getReviewSystemPrompt(baseReviewBody);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });

    it('includes WIP note when workInProgress is true', () => {
        const prompt = getReviewSystemPrompt({ ...baseReviewBody, workInProgress: true });
        expect(prompt).toContain('work in progress');
    });

    it('includes page limit note when hasPageLimit and pageLimit are set', () => {
        const prompt = getReviewSystemPrompt({
            ...baseReviewBody,
            hasPageLimit: true,
            pageLimit: '8',
            currentPages: '7',
        });
        expect(prompt).toContain('page limit of 8 pages');
    });

    it('works without a body argument', () => {
        const prompt = getReviewSystemPrompt();
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });
});

describe('getAseSystemPrompt', () => {
    it('returns a non-empty string', () => {
        const prompt = getAseSystemPrompt(baseReviewBody);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });

    it('mentions ASE', () => {
        const prompt = getAseSystemPrompt(baseReviewBody);
        expect(prompt).toContain('ASE');
    });

    it('works without a body argument', () => {
        const prompt = getAseSystemPrompt();
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });
});

describe('getSectionsSystemPrompt', () => {
    it('returns a string mentioning section extraction', () => {
        const prompt = getSectionsSystemPrompt();
        expect(typeof prompt).toBe('string');
        expect(prompt.toLowerCase()).toContain('section');
    });
});
