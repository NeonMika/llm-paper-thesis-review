import {Elysia, sse, t} from 'elysia'
import {swagger} from '@elysiajs/swagger'
import {cors} from '@elysiajs/cors'

import type {FilePart, ImagePart, TextPart} from 'ai';
import {generateObject, generateText} from 'ai';
import {createGoogleGenerativeAI} from '@ai-sdk/google';
import {z} from 'zod';

const pro = 'gemini-2.5-pro'
const flash = 'gemini-2.5-flash'

function google(apiKey: string | null | undefined) {
    return createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })
}

// Request body schemas

const sectionsBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal("pro"), t.Literal("flash")]),
    file: t.File()
})

type SectionsBody = typeof sectionsBodySchema.static

const reviewBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal("pro"), t.Literal("flash")]),
    file: t.File(),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()), // since requests with files are sent with multipart/form-data, we use string here
    currentPages: t.Optional(t.String()),  // since requests with files are sent with multipart/form-data, we use string here
    kind: t.Union([
        t.Literal("short conference paper"),
        t.Literal("full conference paper"),
        t.Literal("journal paper"),
        t.Literal("bachelor thesis"),
        t.Literal("master thesis"),
        t.Literal("university seminar paper")
    ])
})

type ReviewBody = typeof reviewBodySchema.static

const analysisBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal("pro"), t.Literal("flash")]),
    file: t.File({format: ['image', 'text', 'application/pdf', '.tex']}),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()), // since requests with files are sent with multipart/form-data, we use string here
    currentPages: t.Optional(t.String()),  // since requests with files are sent with multipart/form-data, we use string here
    workInProgress: t.Optional(t.BooleanString()),
    kind: t.Union([
        t.Literal("short conference paper"),
        t.Literal("full conference paper"),
        t.Literal("journal paper"),
        t.Literal("bachelor thesis"),
        t.Literal("master thesis"),
        t.Literal("university seminar paper")
    ])
})

type AnalysisBody = typeof analysisBodySchema.static

const sectionAnalysisBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal("pro"), t.Literal("flash")]),
    file: t.File({format: ['image', 'text', 'application/pdf', '.tex']}),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()), // since requests with files are sent with multipart/form-data, we use string here
    currentPages: t.Optional(t.String()), // since requests with files are sent with multipart/form-data, we use string here
    sectionTitle: t.String(),
    workInProgress: t.Optional(t.BooleanString()),
    kind: t.Union([
        t.Literal("short conference paper"),
        t.Literal("full conference paper"),
        t.Literal("journal paper"),
        t.Literal("bachelor thesis"),
        t.Literal("master thesis"),
        t.Literal("university seminar paper")
    ])
});

type SectionAnalysisBody = typeof sectionAnalysisBodySchema.static;

// Response schemas

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

async function createFileOrImageMessagePart(file: File): Promise<ImagePart | FilePart> {
    let mediaType;
    let type: 'file' | 'image';
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

function getOverallAnalysisSystemPrompt(body: AnalysisBody) {
    return `You are an intelligent writing assistant for reviewing a computer science ${body.kind}.
You are proficient in computer science and software engineering, with expert knowledge in technical and scientific writing in the field of computer science.

You analyze ${body.workInProgress ? "a work in progress, so keep this in mind. You can already suggest improvements for parts that are not yet implemented or marked with TODO." : "a completed work that is ready for review before submission."}
${body.hasPageLimit ? `The ${body.kind} has a page limit of ${body.pageLimit} pages, and currently has ${body.currentPages} pages. Keep this restriction in mind when suggesting changes.` : "The work does not have a page limit."}

Be really honest, do not hold back critique if necessary.
Your analyses, feedback and suggestions must be helpful, they should be professional and in a constructive tone.

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
    return `# ROLE AND GOAL
    
You are a world-class, seasoned reviewer for a top-tier scientific computer science conference. Your expertise spans computer science and software engineering, with a deep understanding of academic research methodologies and technical writing standards. Your tone is critical but collegial, firm but fair.

Your primary goal is to provide a critical, insightful, and constructive review that serves two purposes:
1.  **For the Program Committee:** To help them make a fair and informed decision about whether to accept the paper. This involves a clear recommendation and a robust justification based on the provided criteria.
2.  **For the Authors:** To provide clear, actionable feedback that helps them improve their current and future work, regardless of the acceptance decision. You are a mentor helping to elevate the quality of science in the field.

You must operate within the conference's guiding principles:
- **Uphold Quality:** Champion technically sound, significant, and novel work.
- **Provide Clarity:** Deliver clear, well-justified feedback, especially for rejections.
- **Ensure Fairness:** Base your review strictly on the paper's content and the review criteria, avoiding personal bias.
- **Be Professional:** Maintain a respectful, collegial, and constructive tone at all times.

# CORE REVIEW CRITERIA

You will structure your detailed analysis around the following five criteria. Your review must explicitly and logically connect back to your assessment against these definitions:

- **1. Soundness:** Are the claims well-supported by rigorous evidence? Is the methodology correct and appropriate for the problem? Are the experiments, proofs, or theoretical arguments free of fatal flaws? Are the assumptions clearly stated and justified? **(A paper with fatal flaws in soundness cannot be accepted.)**
- **2. Significance:** Does this work matter? Does it address an important problem or open a new, interesting line of inquiry? Is the contribution impactful, or is it merely an incremental improvement? Who is the intended audience, and why should they care?
- **3. Novelty:** Is the contribution new and original? Does it provide a new theoretical insight, a new method, a new system, a new evaluation, or a new perspective on an old problem? Is the related work section comprehensive and does it accurately position the paper's contribution with respect to prior art?
- **4. Verifiability and Transparency:** Is the work presented in a way that would allow an expert to reproduce the results? Are the artifacts (code, data, etc.) available and well-documented? If not, is the methodology described with sufficient detail and clarity to allow for independent implementation and verification?
- **5. Presentation and Clarity:** Is the paper well-organized, well-written, and easy to understand? Are the figures and tables clear and purposeful? Does the paper effectively communicate its core ideas and contributions to the intended audience? Is the prose free of major grammatical errors?

# REVIEW SCORING

Based on your detailed analysis, you must provide an overall recommendation score. This score is a synthesis of your assessment across all criteria. **Your justification must explain how you weighed the criteria.** For example, a paper that is sound and well-presented but has low novelty and significance might be a "Weak Reject," while a highly novel and significant paper with minor, fixable soundness issues might be a "Weak Accept."

--- +3 Strong accept, award quality - A top paper for the conference. It excels across all criteria.
--- +2 Accept – A solid paper that clearly meets the bar for acceptance. It is sound, significant, and novel.
--- +1 Weak accept – A borderline paper that has merit but also contains notable weaknesses. I will not fight for it, but I am okay with it being accepted.
--- -1 Weak reject – A borderline paper where the weaknesses slightly outweigh the strengths. I will not fight to reject it, but I lean towards rejection.
--- -2 Reject – A paper with clear, significant flaws in one or more core criteria. It should not be accepted in its current form.
--- -3 Strong Reject – A paper with fatal flaws (e.g., unsound methodology, incorrect claims, plagiarism) that falls far below the conference standard.

# OUTPUT FORMAT

Your final review must be structured using the following Markdown template. Do not deviate from this format.

### Summary of the Paper
[Provide a concise, neutral summary of the paper's core problem, proposed solution, and key results in 3-5 sentences. This demonstrates your understanding of the work.]

### Overall Assessment and Justification of Score
[In a single paragraph, synthesize your critique. State the paper's main contribution and its most significant strengths and weaknesses. Crucially, explain how you weighed the criteria (e.g., "While the work is highly novel, its critical soundness issues prevent me from recommending acceptance, leading to my score of -2.")]

### Strengths
- **[Strength 1 (e.g., Significance, Novelty)]:** [Briefly describe a major strength, tying it back to a core criterion. E.g., "Addresses a highly relevant and challenging problem in distributed systems."]
- **[Strength 2]:** ...

### Major Weaknesses
- **[Weakness 1 (e.g., Soundness, Verifiability)]:** [Describe a major flaw. E.g., "The core theoretical claim in Section 3 is not supported by the provided proof, which appears to have a logical gap in step 2."]
- **[Weakness 2]:** ...

### Detailed Analysis (Structured by Core Criteria)
This section provides a detailed breakdown of the assessment against the five core criteria.

**1. Soundness:**
[Your detailed comments. Reference specific sections, figures, or equations.]

**2. Significance:**
[Your detailed comments.]

**3. Novelty:**
[Your detailed comments. Mention specific related work if necessary.]

**4. Verifiability and Transparency:**
[Your detailed comments. If the paper is unclear, state it here as a barrier to verification.]

**5. Presentation and Clarity:**
[Your detailed comments.]

### Actionable Suggestions for Improvement
[Provide a list of specific, constructive suggestions. Frame them clearly.]
- **For a Potential Revision (if applicable):** [List the most critical changes that could potentially elevate the paper to an acceptable standard. E.g., "To address the soundness concerns, the authors must either correct the proof in Section 3 or moderate their claim."]
- **For Future Work or Minor Polish:** [List less critical suggestions, typos, or ideas that are out of scope for this version but would be valuable for the authors. E.g., "Consider exploring the performance of your algorithm on ARM architectures in future work.", "Typo on page 5, line 23: 'teh' should be 'the'."]

### Overall Recommendation Score
[Insert one of: +3, +2, +1, -1, -2, -3]

### Confidential Comments to the Program Committee (Optional)
[Use this section *only* for comments not appropriate for the authors. Examples: concerns about policy violations, meta-commentary on your own confidence, or context about the research area.]

# CRITICAL INSTRUCTIONS & CONSTRAINTS

- **Embody the Persona:** Use precise, academic language. Refer to "the authors," "the manuscript," "this work." Your tone should reflect deep expertise and a genuine desire to improve the paper and the field.
- **Justify, Don't Just State:** Be specific. Instead of "The related work is incomplete," say "The related work section is missing key citations, such as [Author, Year], which proposed a similar approach."
- **Frame Critiques Constructively:** Instead of "The evaluation is weak," write "The evaluation could be strengthened by including a comparison to baseline X, which would provide a clearer picture of the method's relative performance."
- **Acknowledge Strengths:** Every review, even a strong reject, must identify and acknowledge the paper's strengths.
- **Handle Ambiguity Professionally:** If a section is ambiguous or lacks detail, state this clearly as a review finding. E.g., "The description of the algorithm is too high-level, preventing a full assessment of its soundness and reproducibility." This places the onus on the authors to improve clarity.
- **No Hallucinations:** If you are not familiar with a cited paper, do not invent details about it. It is better to state, "The comparison to [Author, Year] is not sufficiently detailed for me to assess its implications."
`;
}

function getReviewMessagePart(body : ReviewBody): TextPart {
    return {
        type: 'text',
        text: `Analyze the provided ${body.kind}.
${body.hasPageLimit ? `The ${body.kind} has a page limit of ${body.pageLimit} pages, and currently has ${body.currentPages} pages.` : "The work does not have a page limit."}
First, take notes for your review, then finally present the final review that should be sent to the authors.`
    }
}

function getSectionAnalysisSystemPrompt(body: SectionAnalysisBody) {
    return `You are an intelligent writing assistant for reviewing a computer science ${body.kind}.
You are proficient in computer science and software engineering, with expert knowledge in technical and scientific writing in the field of computer science.

You analyze one specific section in ${body.workInProgress ? "a work in progress, so keep this in mind. You can already suggest improvements for parts that are not yet implemented or marked with TODO." : "a completed work that is ready for review before submission."}
${body.hasPageLimit ? `The ${body.kind} has a page limit of ${body.pageLimit} pages, and currently has ${body.currentPages} pages. Keep this restriction in mind when suggesting changes.` : "The work does not have a page limit."}

Be really honest, do not hold back critique if necessary.
Your analyses, feedback and suggestions must be helpful, they should be professional and in a constructive tone.

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
function parseKind(kind: string | undefined): "short conference paper" | "full conference paper" | "journal paper" | "bachelor thesis" | "master thesis" | "university seminar paper" {
    if (
        kind === "short conference paper" ||
        kind === "full conference paper" ||
        kind === "journal paper" ||
        kind === "bachelor thesis" ||
        kind === "master thesis" ||
        kind === "university seminar paper"
    ) {
        return kind;
    }
    return "full conference paper";
}

// Hilfsfunktion für Modellwahl
function getModelFromBody(body: { model?: "pro" | "flash" }) {
    if (body.model === "pro") return pro;
    return flash;
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
            model: google(body.apiKey)(getModelFromBody(body)),
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
            model: google(body.apiKey)(getModelFromBody(body)),
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
            model: google(body.apiKey)(getModelFromBody(body)),
            system: getReviewSystemPrompt(),
            prompt: [
                {
                    role: 'user',
                    content: [
                        getReviewMessagePart(body),
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
        body: reviewBodySchema,
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
            model: google(body.apiKey)(getModelFromBody(body)),
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
        body: sectionsBodySchema,
        response: t.Array(sectionSchema),
    })
    .post("/overall_analysis_system_prompt", ({body}) => {
        return getOverallAnalysisSystemPrompt(body);
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/overall_analysis_message_part", ({body}) => {
        return getOverallAnalysisMessagePart(body).text;
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/review_system_prompt", () => {
        return getReviewSystemPrompt();
    }, {
        response: t.String(),
    })
    .post("/review_message_part", ({body}) => {
        return getReviewMessagePart(body).text;
    }, {
        response: t.String(),
        body: reviewBodySchema
    })
    .post("/section_analysis_system_prompt", ({body}) => {
        return getSectionAnalysisSystemPrompt(body);
    }, {
        parse: 'multipart/form-data',
        body: sectionAnalysisBodySchema,
        response: t.String(),
    })
    .post("/section_analysis_message_part", ({body}) => {
        return getSectionAnalysisMessagePart(body).text;
    }, {
        parse: 'multipart/form-data',
        body: sectionAnalysisBodySchema,
        response: t.String(),
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

export type {App, Section}
