import { Elysia, t } from 'elysia';
import { generateText } from 'ai';
import { reviewBodySchema } from '../schemas.ts';
import {
    getReviewSystemPrompt,
    getReviewMessagePart,
    getAseSystemPrompt,
    getAseMessagePart,
    withCurrentDate,
} from '../prompts.ts';
import { google, getModelFromBody, normalizePrompt } from '../utils/model.ts';
import { createFileOrImageMessagePart } from '../utils/fileHelpers.ts';
import { logBeforeLLM, logAfterLLM } from '../utils/logging.ts';

export const reviewRoutes = new Elysia()
    .post(
        '/review',
        async ({ body }) => {
            const route = '/review';
            const modelId = getModelFromBody(body);
            const customSys = normalizePrompt(body.customSystemPrompt);
            const systemPrompt = customSys ? withCurrentDate(customSys) : getReviewSystemPrompt(body);
            const customMsg = normalizePrompt(body.customMessagePart);
            const msgPart = getReviewMessagePart(body);
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
            body: reviewBodySchema,
            response: t.String(),
        }
    )
    .post(
        '/ase',
        async ({ body }) => {
            const route = '/ase';
            const modelId = getModelFromBody(body);
            const customSys = normalizePrompt(body.customSystemPrompt);
            const systemPrompt = customSys ? withCurrentDate(customSys) : getAseSystemPrompt(body);
            const customMsg = normalizePrompt(body.customMessagePart);
            const msgPart = getAseMessagePart();
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
            body: reviewBodySchema,
            response: t.String(),
        }
    );
