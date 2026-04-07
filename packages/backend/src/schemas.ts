import { t } from 'elysia';
import { z } from 'zod';

// ─── Request body schemas ─────────────────────────────────────────────────────

export const sectionsBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal('pro'), t.Literal('flash')]),
    file: t.File(),
});

export type SectionsBody = typeof sectionsBodySchema.static;

export const reviewBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal('pro'), t.Literal('flash')]),
    file: t.File(),
    kind: t.Union([
        t.Literal('short conference paper'),
        t.Literal('full conference paper'),
        t.Literal('journal paper'),
        t.Literal('bachelor thesis'),
        t.Literal('master thesis'),
        t.Literal('university seminar paper'),
    ]),
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String()),
    workInProgress: t.Optional(t.BooleanString()),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()),
    currentPages: t.Optional(t.String()),
});

export type ReviewBody = typeof reviewBodySchema.static;

export const analysisBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal('pro'), t.Literal('flash')]),
    file: t.File({ format: ['image', 'text', 'application/pdf', '.tex'] }),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()),
    currentPages: t.Optional(t.String()),
    workInProgress: t.Optional(t.BooleanString()),
    kind: t.Union([
        t.Literal('short conference paper'),
        t.Literal('full conference paper'),
        t.Literal('journal paper'),
        t.Literal('bachelor thesis'),
        t.Literal('master thesis'),
        t.Literal('university seminar paper'),
    ]),
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String()),
});

export type AnalysisBody = typeof analysisBodySchema.static;

export const sectionAnalysisBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal('pro'), t.Literal('flash')]),
    file: t.File({ format: ['image', 'text', 'application/pdf', '.tex'] }),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()),
    currentPages: t.Optional(t.String()),
    sectionTitle: t.String(),
    workInProgress: t.Optional(t.BooleanString()),
    kind: t.Union([
        t.Literal('short conference paper'),
        t.Literal('full conference paper'),
        t.Literal('journal paper'),
        t.Literal('bachelor thesis'),
        t.Literal('master thesis'),
        t.Literal('university seminar paper'),
    ]),
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String()),
});

export type SectionAnalysisBody = typeof sectionAnalysisBodySchema.static;

export const followUpBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal('pro'), t.Literal('flash')]),
    systemPrompt: t.String(),
    conversationHistory: t.String(), // JSON: {role:'user'|'assistant', content:string}[]
    newFile: t.Optional(t.File()),
    textMessage: t.Optional(t.String()),
});

export type FollowUpBody = typeof followUpBodySchema.static;

// ─── Response schemas ─────────────────────────────────────────────────────────

export const zSectionSchema = z.object({
    title: z.string(),
    sectionNumber: z.string().optional(),
    subsections: z
        .array(
            z.object({
                title: z.string(),
                subsectionNumber: z.string().optional(),
                subsubsections: z
                    .array(
                        z.object({
                            title: z.string(),
                            subsubsectionNumber: z.string().optional(),
                        })
                    )
                    .optional(),
            })
        )
        .optional(),
});

export type Section = z.infer<typeof zSectionSchema>;
