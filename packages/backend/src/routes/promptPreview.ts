import { Elysia, t } from 'elysia';
import {
    publicationPromptContextSchema,
    sectionAnalysisBodySchema,
    studentWorkPromptContextSchema,
} from '../schemas.ts';
import {
    getSectionAnalysisMessagePart,
    getSectionAnalysisSystemPrompt,
    getSectionsSystemPrompt,
} from '../prompts.ts';
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
} from '../reviewTypePrompts.ts';

const promptBundleSchema = t.Object({
    systemPrompt: t.String(),
    messagePart: t.String(),
});

const publicationPromptRouteSchema = {
    body: publicationPromptContextSchema,
    response: promptBundleSchema,
};

const studentWorkPromptRouteSchema = {
    body: studentWorkPromptContextSchema,
    response: promptBundleSchema,
};

export const promptPreviewRoutes = new Elysia()
    .post(
        '/prompts/thesis-analysis',
        ({ body }) => buildThesisAnalysisPrompt(body),
        studentWorkPromptRouteSchema
    )
    .post(
        '/prompts/thesis-analysis-detailed',
        ({ body }) => buildThesisAnalysisDetailedPrompt(body),
        studentWorkPromptRouteSchema
    )
    .post(
        '/prompts/analysis',
        ({ body }) => buildAnalysisPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/prompts/analysis-detailed',
        ({ body }) => buildAnalysisDetailedPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/prompts/review-critical',
        ({ body }) => buildReviewCriticalPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/prompts/review',
        ({ body }) => buildReviewPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/prompts/review-guardian',
        ({ body }) => buildReviewGuardianPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/prompts/ase-review-critical',
        ({ body }) => buildAseReviewCriticalPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/prompts/ase-review',
        ({ body }) => buildAseReviewPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/prompts/ase-review-guardian',
        ({ body }) => buildAseReviewGuardianPrompt(body),
        publicationPromptRouteSchema
    )
    .post(
        '/section_analysis_system_prompt',
        ({ body }) => getSectionAnalysisSystemPrompt(body),
        {
            parse: 'multipart/form-data',
            body: sectionAnalysisBodySchema,
            response: t.String(),
        }
    )
    .post(
        '/section_analysis_message_part',
        ({ body }) => getSectionAnalysisMessagePart(body).text,
        {
            parse: 'multipart/form-data',
            body: sectionAnalysisBodySchema,
            response: t.String(),
        }
    )
    .get('/sections_system_prompt', () => getSectionsSystemPrompt(), { response: t.String() });
