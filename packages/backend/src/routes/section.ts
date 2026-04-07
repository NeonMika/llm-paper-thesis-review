import { Elysia, t } from 'elysia';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { sectionAnalysisBodySchema, sectionsBodySchema, zSectionSchema } from '../schemas.ts';
import {
    getSectionAnalysisSystemPrompt,
    getSectionAnalysisMessagePart,
    getSectionsSystemPrompt,
} from '../prompts.ts';
import { google, getModelFromBody, normalizePrompt } from '../utils/model.ts';
import { createFileOrImageMessagePart } from '../utils/fileHelpers.ts';
import { logBeforeLLM, logAfterLLM } from '../utils/logging.ts';

export const sectionRoutes = new Elysia()
    .post(
        '/section_analysis',
        async ({ body }) => {
            const route = '/section_analysis';
            const modelId = getModelFromBody(body);
            const customSys = normalizePrompt(body.customSystemPrompt);
            const systemPrompt = customSys ?? getSectionAnalysisSystemPrompt(body);
            const customMsg = normalizePrompt(body.customMessagePart);
            const msgPart = getSectionAnalysisMessagePart(body);
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
            body: sectionAnalysisBodySchema,
            response: t.String(),
        }
    )
    .post(
        '/sections',
        async ({ body }) => {
            const route = '/sections';
            const modelId = getModelFromBody(body);
            const systemPrompt = getSectionsSystemPrompt();

            logBeforeLLM(route, body, {
                modelId,
                systemPrompt,
                promptSummary: 'extract section titles using schema: SectionTitles',
            });

            const result = await generateObject({
                model: google(body.apiKey)(modelId),
                schemaName: 'SectionTitles',
                schemaDescription:
                    'A list of sections extracted from a document, including optional information about numbering and sub(sub)sections.',
                schema: z.array(zSectionSchema),
                system: systemPrompt,
                prompt: [
                    {
                        role: 'user',
                        content: [await createFileOrImageMessagePart(body.file)],
                    },
                ],
            });

            logAfterLLM(route, result);
            return result.object;
        },
        {
            parse: 'multipart/form-data',
            body: sectionsBodySchema,
            response: t.Array(t.Any()),
        }
    );
