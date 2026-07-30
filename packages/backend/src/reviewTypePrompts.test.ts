import { describe, expect, it } from 'bun:test';
import type { PromptContext } from './schemas.ts';
import {
    REVIEW_TYPES,
    buildAnalysisDetailedPrompt,
    buildAnalysisPrompt,
    buildAseReviewCriticalPrompt,
    buildAseReviewGuardianPrompt,
    buildAseReviewPrompt,
    buildReviewCriticalPrompt,
    buildReviewGuardianPrompt,
    buildReviewPrompt,
    buildThesisAnalysisDetailedPrompt,
    buildThesisAnalysisPrompt,
    type PromptBundle,
    type ReviewType,
} from './reviewTypePrompts.ts';
import { promptPreviewRoutes } from './routes/promptPreview.ts';
import { resolveReviewPrompts, reviewRoutes } from './routes/review.ts';

const studentWorkContext: PromptContext = {
    kind: 'master thesis',
    workInProgress: true,
    hasPageLimit: true,
    pageLimit: '80',
    currentPages: '72',
};

const publicationContext: PromptContext = {
    ...studentWorkContext,
    kind: 'full conference paper',
    pageLimit: '12',
    currentPages: '10',
};

const builders: Record<ReviewType, (body: PromptContext) => PromptBundle> = {
    'thesis-analysis': buildThesisAnalysisPrompt,
    'thesis-analysis-detailed': buildThesisAnalysisDetailedPrompt,
    analysis: buildAnalysisPrompt,
    'analysis-detailed': buildAnalysisDetailedPrompt,
    'review-critical': buildReviewCriticalPrompt,
    review: buildReviewPrompt,
    'review-guardian': buildReviewGuardianPrompt,
    'ase-review-critical': buildAseReviewCriticalPrompt,
    'ase-review': buildAseReviewPrompt,
    'ase-review-guardian': buildAseReviewGuardianPrompt,
};

function contextFor(reviewType: ReviewType): PromptContext {
    return reviewType.startsWith('thesis-') ? studentWorkContext : publicationContext;
}

describe('review type prompt bundles', () => {
    it('has one non-empty prompt builder for every ReviewType', () => {
        expect(Object.keys(builders).sort()).toEqual([...REVIEW_TYPES].sort());

        for (const reviewType of REVIEW_TYPES) {
            const bundle = builders[reviewType](contextFor(reviewType));
            expect(bundle.systemPrompt).toMatch(/^Current date: \d{4}-\d{2}-\d{2}\./);
            expect(bundle.messagePart.length).toBeGreaterThan(0);
        }
    });

    it('keeps analysis focus and detail level fixed by the builder', () => {
        const thesis = buildThesisAnalysisPrompt(studentWorkContext);
        const paper = buildAnalysisPrompt(publicationContext);
        const detailed = buildAnalysisDetailedPrompt(publicationContext);

        expect(thesis.systemPrompt).toContain('student-work perspective');
        expect(paper.systemPrompt).toContain('publication-focused perspective');
        expect(thesis.messagePart).not.toContain('# Feedback per Section');
        expect(detailed.messagePart).toContain('# Feedback per Section');
    });

    it('keeps reviewer personas distinct and self-contained', () => {
        const critical = buildReviewCriticalPrompt(publicationContext).systemPrompt;
        const balanced = buildReviewPrompt(publicationContext).systemPrompt;
        const guardian = buildReviewGuardianPrompt(publicationContext).systemPrompt;

        expect(critical).toContain('probing critical reviewer');
        expect(critical).not.toContain('author-supportive guardian reviewer');
        expect(balanced).toContain('balanced, evidence-based reviewer');
        expect(guardian).toContain('author-supportive guardian reviewer');
        expect(guardian).not.toContain('You still');
        expect(guardian).not.toContain('same acceptance bar');
    });
});

describe('review type routes', () => {
    const expectedPromptPaths = REVIEW_TYPES.map((type) => `/prompts/${type}`).sort();
    const expectedReviewPaths = REVIEW_TYPES.map((type) => `/reviews/${type}`).sort();

    it('exposes exactly one prompt-preview route per ReviewType', () => {
        const promptRoutes = promptPreviewRoutes.routes.filter((route) =>
            route.path.startsWith('/prompts/')
        );
        const paths = promptRoutes.map((route) => route.path).sort();
        expect(paths).toEqual(expectedPromptPaths);
        expect(promptRoutes.every((route) => route.method === 'POST')).toBe(true);
        expect(
            promptPreviewRoutes.routes.some((route) =>
                [
                    '/overall_analysis_system_prompt',
                    '/review_system_prompt',
                    '/ase_system_prompt',
                ].includes(route.path)
            )
        ).toBe(false);
    });

    it('exposes exactly one execution route per ReviewType', () => {
        const paths = reviewRoutes.routes.map((route) => route.path).sort();
        expect(paths).toEqual(expectedReviewPaths);
        expect(reviewRoutes.routes.every((route) => route.method === 'POST')).toBe(true);
    });

    it('builds every preview from JSON context without a file, model, or API key', async () => {
        for (const reviewType of REVIEW_TYPES) {
            const response = await promptPreviewRoutes.handle(
                new Request(`http://localhost/prompts/${reviewType}`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(contextFor(reviewType)),
                })
            );
            expect(response.status).toBe(200);
            const bundle = (await response.json()) as PromptBundle;
            expect(bundle).toEqual(builders[reviewType](contextFor(reviewType)));
        }
    });

    it('rejects document kinds that contradict the ReviewType family', async () => {
        const publicationAsThesis = await promptPreviewRoutes.handle(
            new Request('http://localhost/prompts/thesis-analysis', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(publicationContext),
            })
        );
        const thesisAsPublication = await promptPreviewRoutes.handle(
            new Request('http://localhost/prompts/review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(studentWorkContext),
            })
        );

        expect(publicationAsThesis.status).toBe(422);
        expect(thesisAsPublication.status).toBe(422);
    });

    it('rejects incomplete page-limit context instead of rendering undefined values', async () => {
        const response = await promptPreviewRoutes.handle(
            new Request('http://localhost/prompts/analysis', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    kind: 'journal paper',
                    workInProgress: false,
                    hasPageLimit: true,
                }),
            })
        );

        expect(response.status).toBe(422);
    });

    it('accepts the frontend defaults and decimal page counts', async () => {
        const defaultsResponse = await promptPreviewRoutes.handle(
            new Request('http://localhost/prompts/analysis', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    kind: 'journal paper',
                    workInProgress: false,
                    hasPageLimit: false,
                    pageLimit: '1',
                    currentPages: '0',
                }),
            })
        );
        const decimalResponse = await promptPreviewRoutes.handle(
            new Request('http://localhost/prompts/analysis', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    kind: 'journal paper',
                    workInProgress: false,
                    hasPageLimit: true,
                    pageLimit: '12.5',
                    currentPages: '10.5',
                }),
            })
        );

        expect(defaultsResponse.status).toBe(200);
        expect(decimalResponse.status).toBe(200);
    });

    it('rejects a zero page limit even when page-limit handling is enabled', async () => {
        const response = await promptPreviewRoutes.handle(
            new Request('http://localhost/prompts/analysis', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    kind: 'journal paper',
                    workInProgress: false,
                    hasPageLimit: true,
                    pageLimit: '0',
                    currentPages: '0',
                }),
            })
        );

        expect(response.status).toBe(422);
    });
});

describe('review prompt overrides', () => {
    const defaults: PromptBundle = {
        systemPrompt: 'Current date: 2026-01-01.\n\ndefault system',
        messagePart: 'default message',
    };

    it('uses fixed endpoint defaults when overrides are absent or placeholders', () => {
        expect(resolveReviewPrompts({}, defaults)).toEqual(defaults);
        expect(
            resolveReviewPrompts(
                { customSystemPrompt: 'undefined', customMessagePart: ' null ' },
                defaults
            )
        ).toEqual(defaults);
    });

    it('applies valid custom prompts and normalizes the date prefix', () => {
        const resolved = resolveReviewPrompts(
            {
                customSystemPrompt: 'Current date: 2020-01-01.\n\ncustom system',
                customMessagePart: 'custom message',
            },
            defaults
        );

        expect(resolved.systemPrompt).toMatch(/^Current date: \d{4}-\d{2}-\d{2}\.\n\ncustom system$/);
        expect(resolved.messagePart).toBe('custom message');
    });
});
