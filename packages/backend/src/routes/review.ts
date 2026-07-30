import { Elysia, t } from 'elysia';
import { generateText } from 'ai';
import {
    publicationReviewBodySchema,
    studentWorkReviewBodySchema,
    type ReviewBody,
} from '../schemas.ts';
import { withCurrentDate } from '../prompts.ts';
import {
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
} from '../reviewTypePrompts.ts';
import { google, getModelFromBody, normalizePrompt } from '../utils/model.ts';
import { createFileOrImageMessagePart } from '../utils/fileHelpers.ts';
import { logBeforeLLM, logAfterLLM } from '../utils/logging.ts';

export function resolveReviewPrompts(
    body: Pick<ReviewBody, 'customSystemPrompt' | 'customMessagePart'>,
    defaults: PromptBundle
): PromptBundle {
    const customSystemPrompt = normalizePrompt(body.customSystemPrompt);
    return {
        systemPrompt: customSystemPrompt
            ? withCurrentDate(customSystemPrompt)
            : defaults.systemPrompt,
        messagePart: normalizePrompt(body.customMessagePart) ?? defaults.messagePart,
    };
}

async function executeReview(route: string, body: ReviewBody, defaults: PromptBundle): Promise<string> {
    const modelId = getModelFromBody(body);
    const { systemPrompt, messagePart } = resolveReviewPrompts(body, defaults);

    logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary: messagePart });

    const result = await generateText({
        model: google(body.apiKey)(modelId),
        system: systemPrompt,
        prompt: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: messagePart },
                    await createFileOrImageMessagePart(body.file),
                ],
            },
        ],
        temperature: 0.7,
    });

    logAfterLLM(route, result);
    return result.text;
}

const publicationReviewRouteSchema = {
    parse: 'multipart/form-data' as const,
    body: publicationReviewBodySchema,
    response: t.String(),
};

const studentWorkReviewRouteSchema = {
    parse: 'multipart/form-data' as const,
    body: studentWorkReviewBodySchema,
    response: t.String(),
};

export const reviewRoutes = new Elysia()
    .post(
        '/reviews/thesis-analysis',
        ({ body }) => executeReview('/reviews/thesis-analysis', body, buildThesisAnalysisPrompt(body)),
        studentWorkReviewRouteSchema
    )
    .post(
        '/reviews/thesis-analysis-detailed',
        ({ body }) =>
            executeReview(
                '/reviews/thesis-analysis-detailed',
                body,
                buildThesisAnalysisDetailedPrompt(body)
            ),
        studentWorkReviewRouteSchema
    )
    .post(
        '/reviews/analysis',
        ({ body }) => executeReview('/reviews/analysis', body, buildAnalysisPrompt(body)),
        publicationReviewRouteSchema
    )
    .post(
        '/reviews/analysis-detailed',
        ({ body }) =>
            executeReview('/reviews/analysis-detailed', body, buildAnalysisDetailedPrompt(body)),
        publicationReviewRouteSchema
    )
    .post(
        '/reviews/review-critical',
        ({ body }) => executeReview('/reviews/review-critical', body, buildReviewCriticalPrompt(body)),
        publicationReviewRouteSchema
    )
    .post(
        '/reviews/review',
        ({ body }) => executeReview('/reviews/review', body, buildReviewPrompt(body)),
        publicationReviewRouteSchema
    )
    .post(
        '/reviews/review-guardian',
        ({ body }) => executeReview('/reviews/review-guardian', body, buildReviewGuardianPrompt(body)),
        publicationReviewRouteSchema
    )
    .post(
        '/reviews/ase-review-critical',
        ({ body }) =>
            executeReview('/reviews/ase-review-critical', body, buildAseReviewCriticalPrompt(body)),
        publicationReviewRouteSchema
    )
    .post(
        '/reviews/ase-review',
        ({ body }) => executeReview('/reviews/ase-review', body, buildAseReviewPrompt(body)),
        publicationReviewRouteSchema
    )
    .post(
        '/reviews/ase-review-guardian',
        ({ body }) =>
            executeReview('/reviews/ase-review-guardian', body, buildAseReviewGuardianPrompt(body)),
        publicationReviewRouteSchema
    );
