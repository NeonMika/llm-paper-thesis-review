import { describe, it, expect } from 'bun:test';
import {
    getOverallAnalysisSystemPrompt,
    getOverallGeneralAnalysisMessagePart,
    getSectionAnalysisSystemPrompt,
    getSectionAnalysisMessagePart,
    getReviewSystemPrompt,
    getAseSystemPrompt,
    getSectionsSystemPrompt,
    withCurrentDate,
} from './prompts';
import type { PromptContext, SectionAnalysisBody } from './schemas';

const baseAnalysisBody: PromptContext = {
    kind: 'full conference paper',
    workInProgress: false,
    hasPageLimit: false,
    pageLimit: '12',
    currentPages: '10',
};

const baseSectionBody: SectionAnalysisBody = {
    model: 'flash',
    file: new File([''], 'paper.pdf'),
    kind: 'master thesis',
    sectionTitle: 'Introduction',
    workInProgress: false,
    hasPageLimit: false,
    pageLimit: '80',
    currentPages: '72',
};

const baseReviewBody: PromptContext = {
    kind: 'full conference paper',
    workInProgress: false,
    hasPageLimit: false,
    pageLimit: '12',
    currentPages: '10',
};

const currentDatePattern = /^Current date: \d{4}-\d{2}-\d{2}\.\n\n/;

describe('getOverallAnalysisSystemPrompt', () => {
    it('starts with the current date', () => {
        const prompt = getOverallAnalysisSystemPrompt(baseAnalysisBody, 'paper');
        expect(prompt).toMatch(currentDatePattern);
    });

    it('includes the paper kind', () => {
        const prompt = getOverallAnalysisSystemPrompt(baseAnalysisBody, 'paper');
        expect(prompt).toContain('full conference paper');
    });

    it('mentions work in progress when workInProgress is true', () => {
        const prompt = getOverallAnalysisSystemPrompt(
            { ...baseAnalysisBody, workInProgress: true },
            'paper'
        );
        expect(prompt).toContain('work in progress');
    });

    it('mentions completed work when workInProgress is false', () => {
        const prompt = getOverallAnalysisSystemPrompt(
            { ...baseAnalysisBody, workInProgress: false },
            'paper'
        );
        expect(prompt).toContain('completed work');
    });

    it('includes page limit context when hasPageLimit is true', () => {
        const prompt = getOverallAnalysisSystemPrompt(
            {
                ...baseAnalysisBody,
                hasPageLimit: true,
                pageLimit: '12',
                currentPages: '10',
            },
            'paper'
        );
        expect(prompt).toContain('page limit of 12 pages');
        expect(prompt).toContain('currently has 10 pages');
    });

    it('does not include page limit when hasPageLimit is false', () => {
        const prompt = getOverallAnalysisSystemPrompt(
            { ...baseAnalysisBody, hasPageLimit: false },
            'paper'
        );
        expect(prompt).toContain('does not have a page limit');
    });

    it('can focus on student thesis feedback', () => {
        const prompt = getOverallAnalysisSystemPrompt(
            { ...baseAnalysisBody, kind: 'master thesis' },
            'thesis'
        );
        const part = getOverallGeneralAnalysisMessagePart(
            { ...baseAnalysisBody, kind: 'master thesis' },
            'thesis'
        );
        expect(prompt).toContain('student-work perspective');
        expect(prompt).toContain('Address the author directly');
        expect(part.text).toContain('academic rigor appropriate to the master thesis');
    });

    it('can focus on conference paper feedback', () => {
        const prompt = getOverallAnalysisSystemPrompt(baseAnalysisBody, 'paper');
        const part = getOverallGeneralAnalysisMessagePart(baseAnalysisBody, 'paper');
        expect(prompt).toContain('publication-focused perspective');
        expect(prompt).toContain('appropriate scholarly venue');
        expect(part.text).toContain('scholarly publication expectations');
    });

    it('uses publication-neutral guidance for journal papers', () => {
        const prompt = getOverallAnalysisSystemPrompt(
            { ...baseAnalysisBody, kind: 'journal paper' },
            'paper'
        );
        expect(prompt).toContain('appropriate scholarly venue');
        expect(prompt).not.toContain('conference submission');
    });
});

describe('getSectionAnalysisSystemPrompt', () => {
    it('starts with the current date', () => {
        const prompt = getSectionAnalysisSystemPrompt(baseSectionBody);
        expect(prompt).toMatch(currentDatePattern);
    });

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

    it('includes page limit context when hasPageLimit is true', () => {
        const prompt = getSectionAnalysisSystemPrompt({
            ...baseSectionBody,
            hasPageLimit: true,
            pageLimit: '10',
            currentPages: '8',
        });
        expect(prompt).toContain('page limit of 10 pages');
        expect(prompt).toContain('8 pages');
    });

    it('uses student-work wording for seminar papers without calling them theses', () => {
        const prompt = getSectionAnalysisSystemPrompt({
            ...baseSectionBody,
            kind: 'university seminar paper',
        });
        expect(prompt).toContain('student-work perspective');
        expect(prompt).toContain('strengthen the work');
        expect(prompt).not.toContain('strengthen the thesis');
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

    it('uses section-specific criteria instead of whole-document criteria', () => {
        const part = getSectionAnalysisMessagePart(baseSectionBody);
        expect(part.text).toContain("the section's role");
        expect(part.text).not.toContain('research questions, objectives, methodology');
    });
});

describe('getReviewSystemPrompt', () => {
    it('starts with the current date', () => {
        const prompt = getReviewSystemPrompt(baseReviewBody, 'default');
        expect(prompt).toMatch(currentDatePattern);
    });

    it('returns a non-empty string', () => {
        const prompt = getReviewSystemPrompt(baseReviewBody, 'default');
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });

    it('includes WIP note when workInProgress is true', () => {
        const prompt = getReviewSystemPrompt(
            { ...baseReviewBody, workInProgress: true },
            'default'
        );
        expect(prompt).toContain('work in progress');
    });

    it('includes page limit note when hasPageLimit and pageLimit are set', () => {
        const prompt = getReviewSystemPrompt(
            {
                ...baseReviewBody,
                hasPageLimit: true,
                pageLimit: '8',
                currentPages: '7',
            },
            'default'
        );
        expect(prompt).toContain('page limit of 8 pages');
    });

    it('supports the critical reviewer persona', () => {
        const prompt = getReviewSystemPrompt(baseReviewBody, 'critical');
        expect(prompt).toContain('probing critical reviewer');
        expect(prompt).toContain('Do not presume rejection');
    });

    it('supports the guardian reviewer persona', () => {
        const prompt = getReviewSystemPrompt(baseReviewBody, 'guardian');
        expect(prompt).toContain('author-supportive guardian reviewer');
        expect(prompt).toContain('without softening findings or inflating the score');
        expect(prompt).not.toContain('You still');
        expect(prompt).not.toContain('same acceptance bar');
    });
});

describe('getAseSystemPrompt', () => {
    it('starts with the current date', () => {
        const prompt = getAseSystemPrompt(baseReviewBody, 'default');
        expect(prompt).toMatch(currentDatePattern);
    });

    it('returns a non-empty string', () => {
        const prompt = getAseSystemPrompt(baseReviewBody, 'default');
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });

    it('mentions ASE', () => {
        const prompt = getAseSystemPrompt(baseReviewBody, 'default');
        expect(prompt).toContain('ASE');
    });

    it('includes WIP note when workInProgress is true', () => {
        const prompt = getAseSystemPrompt(
            { ...baseReviewBody, workInProgress: true },
            'default'
        );
        expect(prompt).toContain('work in progress');
    });

    it('includes page limit note when hasPageLimit and pageLimit are set', () => {
        const prompt = getAseSystemPrompt(
            {
                ...baseReviewBody,
                hasPageLimit: true,
                pageLimit: '6',
                currentPages: '5',
            },
            'default'
        );
        expect(prompt).toContain('page limit of 6 pages');
    });

    it('supports ASE critical and guardian personas', () => {
        const criticalPrompt = getAseSystemPrompt(baseReviewBody, 'critical');
        const guardianPrompt = getAseSystemPrompt(baseReviewBody, 'guardian');
        expect(criticalPrompt).toContain('probing critical reviewer');
        expect(criticalPrompt).not.toContain('author-supportive guardian reviewer');
        expect(guardianPrompt).toContain('author-supportive guardian reviewer');
        expect(guardianPrompt).not.toContain('probing critical reviewer');
    });
});

describe('getSectionsSystemPrompt', () => {
    it('starts with the current date', () => {
        const prompt = getSectionsSystemPrompt();
        expect(prompt).toMatch(currentDatePattern);
    });

    it('returns a string mentioning section extraction', () => {
        const prompt = getSectionsSystemPrompt();
        expect(typeof prompt).toBe('string');
        expect(prompt.toLowerCase()).toContain('section');
    });
});

describe('withCurrentDate', () => {
    it('replaces an existing date prefix instead of duplicating it', () => {
        const prompt = withCurrentDate(
            'Current date: 2026-01-01.\n\nKeep reviewing the paper.',
            new Date('2026-05-29T10:21:36.100Z')
        );

        expect(prompt).toBe('Current date: 2026-05-29.\n\nKeep reviewing the paper.');
    });
});
