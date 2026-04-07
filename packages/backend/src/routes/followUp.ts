import { Elysia, t } from 'elysia';
import { generateText } from 'ai';
import { followUpBodySchema } from '../schemas.ts';
import { getNewFileFollowUpInstruction } from '../prompts.ts';
import { google, getModelFromBody } from '../utils/model.ts';
import { createFileOrImageMessagePart } from '../utils/fileHelpers.ts';
import { logBeforeLLM, logAfterLLM } from '../utils/logging.ts';

export const followUpRoutes = new Elysia().post(
    '/follow_up',
    async ({ body }) => {
        const route = '/follow_up';
        const modelId = getModelFromBody(body);

        let history: { role: 'user' | 'assistant'; content: string }[] = [];
        try {
            history = JSON.parse(body.conversationHistory);
        } catch {
            throw new Error('Invalid conversationHistory JSON');
        }

        const newUserContent: any[] = [];
        if (body.newFile) {
            const instruction = body.textMessage?.trim() || getNewFileFollowUpInstruction();
            newUserContent.push({ type: 'text', text: instruction });
            newUserContent.push(await createFileOrImageMessagePart(body.newFile));
        } else if (body.textMessage && body.textMessage.trim()) {
            newUserContent.push({ type: 'text', text: body.textMessage });
        } else {
            throw new Error('Either newFile or textMessage must be provided');
        }

        const messages: any[] = [
            ...history.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: newUserContent },
        ];

        const promptSummary = body.newFile
            ? `[New file version: ${body.newFile.name}]`
            : (body.textMessage ?? '');

        logBeforeLLM(route, body, { modelId, systemPrompt: body.systemPrompt, promptSummary });

        const result = await generateText({
            model: google(body.apiKey)(modelId),
            system: body.systemPrompt,
            messages,
            temperature: 0.7,
        });

        logAfterLLM(route, result);
        return result.text;
    },
    {
        parse: 'multipart/form-data',
        body: followUpBodySchema,
        response: t.String(),
    }
);
