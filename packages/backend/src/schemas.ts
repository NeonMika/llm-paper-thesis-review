import { t } from 'elysia';
import { z } from 'zod';

// ─── Shared schema constants ──────────────────────────────────────────────────

const modelSchema = t.Union([t.Literal('pro'), t.Literal('flash')]);

export const publicationKindSchema = t.Union([
    t.Literal('short conference paper'),
    t.Literal('full conference paper'),
    t.Literal('journal paper'),
]);

export const studentWorkKindSchema = t.Union([
    t.Literal('bachelor thesis'),
    t.Literal('master thesis'),
    t.Literal('university seminar paper'),
]);

export const paperKindSchema = t.Union([
    t.Literal('short conference paper'),
    t.Literal('full conference paper'),
    t.Literal('journal paper'),
    t.Literal('bachelor thesis'),
    t.Literal('master thesis'),
    t.Literal('university seminar paper'),
]);

export type PaperKind = typeof paperKindSchema.static;
export type PublicationKind = typeof publicationKindSchema.static;
export type StudentWorkKind = typeof studentWorkKindSchema.static;

// ─── Request body schemas ─────────────────────────────────────────────────────

const promptSettingsProperties = {
    workInProgress: t.BooleanString(),
    hasPageLimit: t.BooleanString(),
    pageLimit: t.String({ pattern: '^(0\\.\\d*[1-9]\\d*|[1-9]\\d*(\\.\\d+)?)$' }),
    currentPages: t.String({ pattern: '^(0|[1-9]\\d*)(\\.\\d+)?$' }),
};

/** Context needed to build a review prompt without uploading the reviewed file. */
export const promptContextSchema = t.Object({
    kind: paperKindSchema,
    ...promptSettingsProperties,
});

export const publicationPromptContextSchema = t.Object({
    kind: publicationKindSchema,
    ...promptSettingsProperties,
});

export const studentWorkPromptContextSchema = t.Object({
    kind: studentWorkKindSchema,
    ...promptSettingsProperties,
});

export type PromptContext = typeof promptContextSchema.static;

export const sectionsBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: modelSchema,
    file: t.File({ format: ['image', 'text', 'application/pdf', '.tex'] }),
});

export type SectionsBody = typeof sectionsBodySchema.static;

export const reviewBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: modelSchema,
    file: t.File({ format: ['image', 'text', 'application/pdf', '.tex'] }),
    kind: paperKindSchema,
    ...promptSettingsProperties,
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String()),
});

export type ReviewBody = typeof reviewBodySchema.static;

const reviewRequestProperties = {
    apiKey: t.Optional(t.String()),
    model: modelSchema,
    file: t.File({ format: ['image', 'text', 'application/pdf', '.tex'] }),
    ...promptSettingsProperties,
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String()),
};

export const publicationReviewBodySchema = t.Object({
    ...reviewRequestProperties,
    kind: publicationKindSchema,
});

export const studentWorkReviewBodySchema = t.Object({
    ...reviewRequestProperties,
    kind: studentWorkKindSchema,
});

export const sectionAnalysisBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: modelSchema,
    file: t.File({ format: ['image', 'text', 'application/pdf', '.tex'] }),
    kind: paperKindSchema,
    ...promptSettingsProperties,
    sectionTitle: t.String(),
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
