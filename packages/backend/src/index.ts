import {Elysia, sse, t} from 'elysia'
import {swagger} from '@elysiajs/swagger'
import {cors} from '@elysiajs/cors'

import {FilePart, generateObject, generateText, ImagePart, TextPart} from 'ai';
import {google} from '@ai-sdk/google';
import {z} from 'zod';

const sectionSchema = t.Object({
    title: t.String(),
    sectionNumber: t.Optional(t.String()),
    subsections: t.Optional(
        t.Array(
            // Subsection level
            t.Object({
                title: t.String(),
                subsectionNumber: t.Optional(t.String()),
                subsubsections: t.Optional(
                    t.Array(
                        // Subsubsection level
                        t.Object({
                            title: t.String(),
                            subsubsectionNumber: t.Optional(t.String()),
                        })
                    )
                )
            })
        )
    )
})

const zSectionSchema =
    // Section level
    z.object({
        title: z.string(),
        sectionNumber: z.string().optional(),
        subsections: z.array(
            // Subsection level
            z.object({
                title: z.string(),
                subsectionNumber: z.string().optional(),
                subsubsections: z.array(
                    // Subsubsection level
                    z.object({
                        title: z.string(),
                        subsubsectionNumber: z.string().optional(),
                    })
                ).optional(),
            })
        ).optional(),
    })

type Section = typeof sectionSchema.static;

const analysisBodySchema = t.Object({
    file: t.File({format: ['image', 'text', 'application/pdf', '.tex']}),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()), // since requests with files are sent with multipart/form-data, we use string here
    currentPages: t.Optional(t.String()),  // since requests with files are sent with multipart/form-data, we use string here
    workInProgress: t.Optional(t.BooleanString()),
    kind: /* either "paper", "bsc-thesis" or "msc-thesis" */ t.Union([
        t.Literal("short paper"),
        t.Literal("full paper"),
        t.Literal("bachelor thesis"),
        t.Literal("master thesis")
    ])
})

type AnalysisBody = typeof analysisBodySchema.static

const sectionAnalysisBodySchema = t.Object({
    file: t.File({format: ['image', 'text', 'application/pdf', '.tex']}),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()), // since requests with files are sent with multipart/form-data, we use string here
    currentPages: t.Optional(t.String()), // since requests with files are sent with multipart/form-data, we use string here
    sectionTitle: t.String(),
    workInProgress: t.Optional(t.BooleanString()),
    kind: t.Union([
        t.Literal("short paper"),
        t.Literal("full paper"),
        t.Literal("bachelor thesis"),
        t.Literal("master thesis")
    ])
});

type SectionAnalysisBody = typeof sectionAnalysisBodySchema.static;

async function createFileOrImageMessagePart(file: File): Promise<ImagePart | FilePart> {
    let mediaType;
    let type : 'file' | 'image';
    // Get the file extension and convert to lower case for reliable matching.
    const extension = (file.name.split('.').pop() ?? 'txt').toLowerCase();

    switch (extension) {
        case 'txt':
        case 'md':
        case 'csv':
        case 'json':
            type = 'file';
            mediaType = 'text/plain';
            break;
        case 'pdf':
            type = 'file';
            mediaType = 'application/pdf';
            break;
        case 'png':
            type = 'image'
            mediaType = 'image/png';
            break;
        case 'jpg':
        case 'jpeg':
            type = 'image';
            mediaType = 'image/jpeg';
            break;
        // Add more cases here as needed...
        // e.g., case 'docx': mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break;
        default:
            throw new Error(`Unsupported file type: ${file.name}`);
    }

    if (type === 'image') {
        return {
            type: 'image',
            mediaType: mediaType,
            image: await file.arrayBuffer()
        };
    } else {
        return {
            type: 'file',
            mediaType: mediaType,
            data: await file.arrayBuffer()
        };
    }

}

const pro = 'gemini-2.5-pro'
const flash = 'gemini-2.5-flash'

function getOverallAnalysisSystemPrompt(body: AnalysisBody) {
    return `You are an intelligent writing assistant for reviewing a computer science ${body.kind}.
You are proficient in computer science and software engineering, with expert knowledge in technical and scientific writing in the field of computer science.

You analyze ${body.workInProgress ? "a work in progress, so keep this in mind. You can already suggest improvements for parts that are not yet implemented or marked with TODO." : "a completed work that is ready for review before submission."}
${body.hasPageLimit ? `The ${body.kind} has a page limit of ${body.pageLimit} pages, and currently has ${body.currentPages} pages. Keep this restriction in mind when suggesting changes.` : "The work does not have a page limit."}

Be honest, your analyses, feedback and suggestions should be in a friendly but professional and constructive tone.

Important: When analyzing text files, always ignore comments (for example, lines starting with % in LaTeX or similar comment syntax in other formats). Comments are not part of the actual content and should not be considered in your analysis.
`;
}

function getOverallAnalysisMessagePart(body: AnalysisBody): TextPart {
    return {
        type: 'text',
        text: `Provide a comprehensive analysis of the ${body.kind}, focusing on the following aspects:

# Feedback

First, carefully examine the whole ${body.kind}. Make sure that you completely understand what the work is about.
Once you have fully internalized the topic, provide a general feedback according to the following points for the overall ${body.kind}:

- Assess for **adherence to standards of scientific writing**.
- Assess **understandability**. For example, are there areas where explanations are overly complicated or difficult to understand? Are enough examples and figures used to support complex parts? Are technical terms and abbreviations explained in enough detail?
- Assess **structure**. We strive for good reading flow and readability. For example, does each chapter use a clear structure with subsections, paragraphs, and so on? Are structural elements (lists, enumerations, tables, etc.) used where applicable? Are conjunctions between sentences and transitions between sections and paragraphs used to enhance flow?
- Assess **clarity and text quality**. We want easy-to-follow text that still provides enough detail.
- Assess **all other quality aspects** that are relevant to a computer science ${body.kind}.

# Feedback per Section

Then, assess the ${body.kind} section by section.

Provide a similar feedback as above, but focused on the individual sections.

# Recommendations per Section

Finally, check the ${body.kind} for recommendation and possible improvements, section by section.
For each section, provide a comprehensive list of the most important recommended improvements.
Aim your feedback at specific parts of the text that can be improved.

Provide concise, focused, concrete actionable improvements:
- Each recommendation should have:
--- A "Title"
--- A short "Description" of the issue
--- The "Original" text 
--- The actionable "Suggestion" (make sure your suggestions can be easily integrated, for example by providing concrete text fixes, alternative versions to existing text, or answers to questions that should be addressed.)
--- A short "Explanation" to compare your suggestion with the existing content to highlight the improvement.
`
    }
}

function getReviewSystemPrompt() {
    return `You are an intelligent reviewer for a scientific computer science paper. You are proficient in computer science and software engineering, with expert knowledge in technical and scientific writing in the field of computer science.

You provide a review according.

You provide your review to achieve the following conference goals:
- Accept high quality papers
- Give clear feedback to papers of insufficient quality
- Ensure an unbiased decision-making process
- Embrace diversity of perspectives, but work in an inclusive, safe, collegial environment

A possible strategy for your review is:
- First of all remember the review criteria:
--- Soundness
--- Significance
--- Novelty
--- Verifiability and Transparency
--- Presentation
- Use notes to outline a review organized by the five criteria, so authors can understand your judgments for each criteria.
- Draft your review based on your outline notes.
- Edit your review, making it as constructive and clear as possible. Even a very negative review should be respectful to the author(s), helping to educate them.
- Based on your review and your assessment of the individual criteria, choose a recommendation score (papers that meet all of the criteria should be strongly accepted (though this does not imply that the paper is perfect); papers that fail to meet most of the criteria should be strongly rejected):
--- +3 Strong accept, award quality - this paper should be accepted and it is a good candidate for a distinguished paper award
--- +2 Accept – this paper should be accepted
--- +1 Weak accept – this paper may be accepted, but I will not fight for it
--- -1 Weak reject – this paper may be rejected, but I will not fight against it
--- -2 Reject – this paper should be rejected

Remember that your review is not only a judgment of the paper, but also a service to the authors. Your review should help them improve their work, even if it is rejected.

Excellent reviews are:
- Constructive, explicitly identifying the merits of the work, as well as feasible  ways of addressing any of its weaknesses.
- Insightful, demonstrating expertise on the topic and methods in a work.
- Organized, helping the authors clearly understand the reviewer’s opinions of strengths and weaknesses of the work.
- Impartial, demonstrating a commitment to the reviewing criteria of the conference, and not personal interests, speculation, or bias.
`;
}

function getReviewMessagePart(): TextPart {
    return {
        type: 'text',
        text: `Analyze the provided work. First, take notes for your review, then finally present the final review that should be sent to the authors.`
    }
}

function getSectionAnalysisSystemPrompt(body: SectionAnalysisBody) {
    return `You are an intelligent writing assistant for reviewing a computer science ${body.kind}.
You are proficient in computer science and software engineering, with expert knowledge in technical and scientific writing in the field of computer science.

You analyze on specific section in ${body.workInProgress ? "a work in progress, so keep this in mind. You can already suggest improvements for parts that are not yet implemented or marked with TODO." : "a completed work that is ready for review before submission."}
${body.hasPageLimit ? `The ${body.kind} has a page limit of ${body.pageLimit} pages, and currently has ${body.currentPages} pages. Keep this restriction in mind when suggesting changes.` : "The work does not have a page limit."}

Be honest, your analyses, feedback and suggestions should be in a friendly but professional and constructive tone.

Important: When analyzing text files, always ignore comments (for example, lines starting with % in LaTeX or similar comment syntax in other formats). Comments are not part of the actual content and should not be considered in your analysis.
`;
}

function getSectionAnalysisMessagePart(body: SectionAnalysisBody): TextPart {
    return {
        type: 'text',
        text: `Provide a comprehensive analysis of the section ${body.sectionTitle} in this ${body.kind} according to the following format (do not write a introductory paragraph, just start with the analysis):

# Feedback on Section "${body.sectionTitle}"

<<<
Zone in on the section "${body.sectionTitle}" and provide a comprehensive analysis of this section, focusing on the following aspects:

- Assess for **adherence to standards of scientific writing**.
- Assess **understandability**. For example, are there areas where explanations are overly complicated or difficult to understand? Are enough examples and figures used to support complex parts? Are technical terms and abbreviations explained in enough detail?
- Assess **structure**. We strive for good reading flow and readability. For example, does each chapter use a clear structure with subsections, paragraphs, and so on? Are structural elements (lists, enumerations, tables, etc.) used where applicable? Are conjunctions between sentences and transitions between sections and paragraphs used to enhance flow?
- Assess **clarity and text quality**. We want easy-to-follow text that still provides enough detail.
- Assess **all other quality aspects** that are relevant to a computer science ${body.kind}.
>>>

# Recommendations on Section "${body.sectionTitle}"

<<<
For section "${body.sectionTitle}", provide a comprehensive list of the most important recommended improvements.
Aim your feedback at specific parts of the text that can be improved.

Provide concise, focused, concrete actionable improvements:
- Each recommendation should have:
--- A "Title"
--- A "Description" of the issue
--- The "Original" text 
--- The actionable "Suggestion" (Make sure your suggestions can be easily integrated, for example by providing concrete text fixes, alternative versions to existing text, or answers to questions that should be addressed.)
--- An "Explanation" to compare your suggestion with the existing content to highlight the improvement.
>>>
`
    }
}

function getSectionsSystemPrompt() {
    return "Your are given a document that is split into sections. Extract the section titles. Also include sections that do not have a number (e.g., Abstract)";
}

// Hilfsfunktion für Literal-Typen
function parseKind(kind: string | undefined): "short paper" | "full paper" | "bachelor thesis" | "master thesis" {
    if (kind === "short paper" || kind === "full paper" || kind === "bachelor thesis" || kind === "master thesis") {
        return kind;
    }
    return "full paper";
}

const app = new Elysia({
    serve: {
        // Increase idle timeout to 30 seconds
        idleTimeout: 255,
    },
})
    .use(cors())
    .use(swagger())
    .get("/yield", function* () {
        for (let i = 0; i < 100; i++) {
            yield "" + i;
        }
    })
    .get("/sse", function* ({}) {
        for (let i = 0; i < 100; i++) {
            yield sse("" + i);
        }
    })
    .post("/overall_analysis", async ({body}) => {
        const result = await generateText({
            model: google(flash),
            system: getOverallAnalysisSystemPrompt(body),
            prompt: [
                {
                    role: 'user',
                    content: [
                        getOverallAnalysisMessagePart(body),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
        });

        console.timeLog("Overall analysis result:", JSON.stringify(result, null, 2));

        return result.text;
    }, {
        // type: "multipart/form-data",
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/section_analysis", async ({body}) => {
        const result = await generateText({
            model: google(flash),
            system: getSectionAnalysisSystemPrompt(body),
            prompt: [
                {
                    role: 'user',
                    content: [
                        getSectionAnalysisMessagePart(body),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
        });

        console.timeLog("Section analysis result:", JSON.stringify(result, null, 2));

        return result.text;
    }, {
        type: "multipart/form-data",
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: sectionAnalysisBodySchema,
        response: t.String(),
    })
    .post("/review", async ({body}) => {
        const result = await generateText({
            model: google(flash),
            system: getReviewSystemPrompt(),
            prompt: [
                {
                    role: 'user',
                    content: [
                        getReviewMessagePart(),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
        });

        console.timeLog("Review result:", JSON.stringify(result, null, 2));

        return result.text;
    }, {
        type: "multipart/form-data",
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: t.Object({
            file: t.File()
        }),
        response: t.String(),
    })
    .post("/sections", async ({body}) => {
        /*
        const { text } = await generateText({
          model: 'openai/gpt-4.1',
          system:
            'You are a professional writer. ' +
            'You write simple, clear, and concise content.',
          prompt: `Summarize the following article in 3-5 sentences: ${article}`,
        });

        The result object of generateText contains several promises that resolve when all required data is available:

        result.content: The content that was generated in the last step.
        result.text: The generated text.
        result.reasoning: The full reasoning that the model has generated in the last step.
        result.reasoningText: The reasoning text of the model (only available for some models).
        result.files: The files that were generated in the last step.
        result.sources: Sources that have been used as references in the last step (only available for some models).
        result.toolCalls: The tool calls that were made in the last step.
        result.toolResults: The results of the tool calls from the last step.
        result.finishReason: The reason the model finished generating text.
        result.usage: The usage of the model during the final step of text generation.
        result.totalUsage: The total usage across all steps (for multi-step generations).
        result.warnings: Warnings from the model provider (e.g. unsupported settings).
        result.request: Additional request information.
        result.response: Additional response information, including response messages and body.
        result.providerMetadata: Additional provider-specific metadata.
        result.steps: Details for all steps, useful for getting information about intermediate steps.
        result.experimental_output: The generated structured output using the experimental_output specification.
        */
        /*

        streamText:

        const result = streamText({
          model: 'openai/gpt-4.1',
          prompt: 'Invent a new holiday and describe its traditions.',
        });

        // example: use textStream as an async iterable
        // result.textStream is both a ReadableStream and an AsyncIterable.
        for await (const textPart of result.textStream) {
          console.log(textPart);
        }

        result.toTextStreamResponse(): Creates a simple text stream HTTP response.
        result.pipeTextStreamToResponse(): Writes text delta output to a Node.js response-like object.

        It also provides several promises that resolve when the stream is finished:

        result.content: The content that was generated in the last step.
        result.text: The generated text.
        result.reasoning: The full reasoning that the model has generated.
        result.reasoningText: The reasoning text of the model (only available for some models).
        result.files: Files that have been generated by the model in the last step.
        result.sources: Sources that have been used as references in the last step (only available for some models).
        result.toolCalls: The tool calls that have been executed in the last step.
        result.toolResults: The tool results that have been generated in the last step.
        result.finishReason: The reason the model finished generating text.
        result.usage: The usage of the model during the final step of text generation.
        result.totalUsage: The total usage across all steps (for multi-step generations).
        result.warnings: Warnings from the model provider (e.g. unsupported settings).
        result.steps: Details for all steps, useful for getting information about intermediate steps.
        result.request: Additional request information from the last step.
        result.response: Additional response information from the last step.
        result.providerMetadata: Additional provider-specific metadata from the last step.

        */
        /*
        generateObject:

        You can access the raw response headers and body using the response property.

        */

        const result = await generateObject({
            model: google(flash),
            schemaName: "SectionTitles",
            schemaDescription: "A list of sections extracted from a document, including optional information about numbering and sub(sub)sections.",
            schema: z.array(zSectionSchema),
            system: "Your are given a document that is split into sections. Extract the section titles. Also include sections that do not have a number (e.g., Abstract)",
            // We can either use messages or prompt, but not both.
            // Since prompt also accepts ModelMessage[], we just always use prompt.
            prompt: [
                {
                    role: "user",
                    content: [
                        // { type: 'text', text: 'This is the file?' },
                        await createFileOrImageMessagePart(body.file),
                    ]
                }
            ],
        })

        console.timeLog("Sections result:", JSON.stringify(result, null, 2));

        return result.object
    }, {
        type: "multipart/form-data",
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: t.Object({
            file: t.File()
        }),
        response: t.Array(sectionSchema),
    })
    .post("/overall_analysis_system_prompt", ({ body }) => {
        return getOverallAnalysisSystemPrompt(body);
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/overall_analysis_message_part", ({ body }) => {
        return getOverallAnalysisMessagePart(body);
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.Object({
            type: t.Literal("text"),
            text: t.String()
        }),
    })
    .post("/review_system_prompt", () => {
        return getReviewSystemPrompt();
    }, {
        response: t.String(),
    })
    .post("/review_message_part", () => {
        return getReviewMessagePart();
    }, {
        response: t.Object({
            type: t.Literal("text"),
            text: t.String()
        }),
    })
    .post("/section_analysis_system_prompt", ({ body }) => {
        return getSectionAnalysisSystemPrompt(body);
    }, {
        parse: 'multipart/form-data',
        body: sectionAnalysisBodySchema,
        response: t.String(),
    })
    .post("/section_analysis_message_part", ({ body }) => {
        return getSectionAnalysisMessagePart(body);
    }, {
        parse: 'multipart/form-data',
        body: sectionAnalysisBodySchema,
        response: t.Object({
            type: t.Literal("text"),
            text: t.String()
        }),
    })
    .get("/sections_system_prompt", () => {
        return getSectionsSystemPrompt();
    }, {
        response: t.String(),
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

type App = typeof app;

export {App, Section};
