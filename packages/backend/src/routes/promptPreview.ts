import { Elysia, t } from 'elysia';
import { analysisBodySchema, reviewBodySchema, sectionAnalysisBodySchema } from '../schemas.ts';
import {
    getOverallAnalysisSystemPrompt,
    getOverallGeneralAnalysisMessagePart,
    getOverallDetailedAnalysisMessagePart,
    getReviewSystemPrompt,
    getReviewMessagePart,
    getAseSystemPrompt,
    getAseMessagePart,
    getSectionAnalysisSystemPrompt,
    getSectionAnalysisMessagePart,
    getSectionsSystemPrompt,
} from '../prompts.ts';

const combinedResponse = t.Object({
    systemPrompt: t.String(),
    messagePart: t.String(),
});

export const promptPreviewRoutes = new Elysia()
    .post(
        '/overall_analysis_system_prompt',
        ({ body }) => getOverallAnalysisSystemPrompt(body),
        { parse: 'multipart/form-data', body: analysisBodySchema, response: t.String() }
    )
    .post(
        '/overall_general_analysis_message_part',
        ({ body }) => getOverallGeneralAnalysisMessagePart(body).text,
        { parse: 'multipart/form-data', body: analysisBodySchema, response: t.String() }
    )
    .post(
        '/overall_detailed_analysis_message_part',
        ({ body }) => getOverallDetailedAnalysisMessagePart(body).text,
        { parse: 'multipart/form-data', body: analysisBodySchema, response: t.String() }
    )
    .post(
        '/review_system_prompt',
        ({ body }) => getReviewSystemPrompt(body),
        { parse: 'multipart/form-data', body: reviewBodySchema, response: t.String() }
    )
    .post(
        '/review_message_part',
        ({ body }) => getReviewMessagePart(body).text,
        { parse: 'multipart/form-data', body: reviewBodySchema, response: t.String() }
    )
    .post(
        '/section_analysis_system_prompt',
        ({ body }) => getSectionAnalysisSystemPrompt(body),
        { parse: 'multipart/form-data', body: sectionAnalysisBodySchema, response: t.String() }
    )
    .post(
        '/section_analysis_message_part',
        ({ body }) => getSectionAnalysisMessagePart(body).text,
        { parse: 'multipart/form-data', body: sectionAnalysisBodySchema, response: t.String() }
    )
    .get('/sections_system_prompt', () => getSectionsSystemPrompt(), { response: t.String() })
    .post(
        '/ase_system_prompt',
        ({ body }) => getAseSystemPrompt(body),
        { parse: 'multipart/form-data', body: reviewBodySchema, response: t.String() }
    )
    .post('/ase_message_part', () => getAseMessagePart().text, { response: t.String() })
    .post(
        '/prompt/analysis/combined',
        ({ body }) => ({
            systemPrompt: getOverallAnalysisSystemPrompt(body),
            messagePart: getOverallGeneralAnalysisMessagePart(body).text,
        }),
        { parse: 'multipart/form-data', body: analysisBodySchema, response: combinedResponse }
    )
    .post(
        '/prompt/analysis-detailed/combined',
        ({ body }) => ({
            systemPrompt: getOverallAnalysisSystemPrompt(body),
            messagePart: getOverallDetailedAnalysisMessagePart(body).text,
        }),
        { parse: 'multipart/form-data', body: analysisBodySchema, response: combinedResponse }
    )
    .post(
        '/prompt/review/combined',
        ({ body }) => ({
            systemPrompt: getReviewSystemPrompt(body),
            messagePart: getReviewMessagePart(body).text,
        }),
        { parse: 'multipart/form-data', body: reviewBodySchema, response: combinedResponse }
    )
    .post(
        '/prompt/ase-review/combined',
        ({ body }) => ({
            systemPrompt: getAseSystemPrompt(body),
            messagePart: getAseMessagePart().text,
        }),
        { parse: 'multipart/form-data', body: reviewBodySchema, response: combinedResponse }
    );
