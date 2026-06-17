import { Elysia, t } from 'elysia';
import { generateText } from 'ai';
import { analysisBodySchema } from '../schemas.ts';
import {
    getOverallAnalysisSystemPrompt,
    getOverallGeneralAnalysisMessagePart,
    getOverallDetailedAnalysisMessagePart,
    withCurrentDate,
} from '../prompts.ts';
import { google, getModelFromBody, normalizePrompt } from '../utils/model.ts';
import { createFileOrImageMessagePart } from '../utils/fileHelpers.ts';
import { logBeforeLLM, logAfterLLM } from '../utils/logging.ts';

export const analysisRoutes = new Elysia()
    .post(
        '/overall_analysis_general',
        async ({ body }) => {
            const route = '/overall_analysis_general';
            const modelId = getModelFromBody(body);
            const customSys = normalizePrompt(body.customSystemPrompt);
            const systemPrompt = customSys
                ? withCurrentDate(customSys)
                : getOverallAnalysisSystemPrompt(body);
            const customMsg = normalizePrompt(body.customMessagePart);
            const msgPart = getOverallGeneralAnalysisMessagePart(body);
            const promptSummary = customMsg ?? msgPart.text;

            logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary });

            const result = await generateText({
                model: google(body.apiKey)(modelId),
                system: systemPrompt,
                prompt: [
                    {
                        role: 'user',
                        content: [
                            customMsg
                                ? { type: 'text', text: customMsg }
                                : msgPart,
                            await createFileOrImageMessagePart(body.file),
                        ],
                    },
                ],
                temperature: 0.7,
            });

            logAfterLLM(route, result);
            return result.text;
        },
        {
            parse: 'multipart/form-data',
            body: analysisBodySchema,
            response: t.String(),
        }
    )
    .post(
        '/overall_analysis_detailed',
        async ({ body }) => {
            const route = '/overall_analysis_detailed';
            const modelId = getModelFromBody(body);
            const customSys = normalizePrompt(body.customSystemPrompt);
            const systemPrompt = customSys
                ? withCurrentDate(customSys)
                : getOverallAnalysisSystemPrompt(body);
            const customMsg = normalizePrompt(body.customMessagePart);
            const msgPart = getOverallDetailedAnalysisMessagePart(body);
            const promptSummary = customMsg ?? msgPart.text;

            logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary });

            const result = await generateText({
                model: google(body.apiKey)(modelId),
                system: systemPrompt,
                prompt: [
                    {
                        role: 'user',
                        content: [
                            customMsg
                                ? { type: 'text', text: customMsg }
                                : msgPart,
                            await createFileOrImageMessagePart(body.file),
                        ],
                    },
                ],
                temperature: 0.7,
            });

            logAfterLLM(route, result);
            return result.text;
        },
        {
            parse: 'multipart/form-data',
            body: analysisBodySchema,
            response: t.String(),
        }
    );
