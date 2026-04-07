import {Elysia, t} from 'elysia'
import {swagger} from '@elysiajs/swagger'
import {cors} from '@elysiajs/cors'

import type {FilePart, ImagePart, TextPart} from 'ai';
import {generateObject, generateText} from 'ai';
import {createGoogleGenerativeAI} from '@ai-sdk/google';
import {z} from 'zod';

const pro = 'gemini-3-pro-preview'
const flash = 'gemini-3-flash-preview'

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
    kind: t.Union([
        t.Literal("short conference paper"),
        t.Literal("full conference paper"),
        t.Literal("journal paper"),
        t.Literal("bachelor thesis"),
        t.Literal("master thesis"),
        t.Literal("university seminar paper")
    ]),
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String()),
    workInProgress: t.Optional(t.BooleanString()),
    hasPageLimit: t.Optional(t.BooleanString()),
    pageLimit: t.Optional(t.String()),
    currentPages: t.Optional(t.String()),
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
    ]),
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String())
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
    ]),
    customSystemPrompt: t.Optional(t.String()),
    customMessagePart: t.Optional(t.String())
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

You analyze ${body.workInProgress ? "a work in progress, so keep this in mind. You can already suggest improvements for parts that are not yet implemented or marked with TODO." : "a completed work that is ready for review."}
${body.hasPageLimit ? `The ${body.kind} has a page limit of ${body.pageLimit} pages, and currently has ${body.currentPages} pages. Keep this restriction in mind when suggesting changes.` : "The work does not have a page limit."}

Be really honest, do not hold back critique if necessary.
Your analyses, feedback and suggestions must be helpful, they should be professional and in a constructive tone.

Important: When analyzing text files, always ignore comments (for example, lines starting with % in LaTeX or similar comment syntax in other formats). Comments are not part of the actual content and should not be considered in your analysis.
`;
}

function getOverallGeneralAnalysisMessagePart(body: AnalysisBody): TextPart {
    return {
        type: 'text',
        text: `Provide a comprehensive analysis of the ${body.kind}.

# Feedback

Carefully examine the whole ${body.kind}.
Make sure that you completely understand what the work is about.
Once you have fully internalized the topic, provide feedback according to the following points for the overall ${body.kind}:

- Assess for **adherence to standards of scientific writing**.
- Assess **understandability**. For example, are there areas where explanations are overly complicated or difficult to understand? Are enough examples and figures used to support complex parts? Are technical terms and abbreviations explained in enough detail?
- Assess **structure**. We strive for good reading flow and readability. For example, does each chapter use a clear structure with subsections, paragraphs, and so on? Are structural elements (lists, enumerations, tables, etc.) used where applicable? Are conjunctions between sentences and transitions between sections and paragraphs used to enhance flow?
- Assess **clarity and text quality**. We want easy-to-follow text that still provides enough detail.
- Assess **spelling and grammar**. Make sure that the text is free of spelling mistakes and grammatical errors.
- Assess **American English** or **British English** consistency. Make sure that the text consistently uses either American or British English.
- Assess **all other quality aspects** that are relevant to a computer science ${body.kind}.

For each assessment point, provide _strengths_ and _areas for improvement_ (if any).
`
    }
}

function getOverallDetailedAnalysisMessagePart(body: AnalysisBody): TextPart {
    return {
        type: 'text',
        text: `Provide a comprehensive analysis of the ${body.kind}.

# Feedback

First, carefully examine the whole ${body.kind}.
Make sure that you completely understand what the work is about.
Once you have fully internalized the topic, provide feedback according to the following points for the overall ${body.kind}:

- Assess for **adherence to standards of scientific writing**.
- Assess **understandability**. For example, are there areas where explanations are overly complicated or difficult to understand? Are enough examples and figures used to support complex parts? Are technical terms and abbreviations explained in enough detail?
- Assess **structure**. We strive for good reading flow and readability. For example, does each chapter use a clear structure with subsections, paragraphs, and so on? Are structural elements (lists, enumerations, tables, etc.) used where applicable? Are conjunctions between sentences and transitions between sections and paragraphs used to enhance flow?
- Assess **clarity and text quality**. We want easy-to-follow text that still provides enough detail.
- Assess **spelling and grammar**. Make sure that the text is free of spelling mistakes and grammatical errors.
- Assess **American English** or **British English** consistency. Make sure that the text consistently uses either American or British English.
- Assess **all other quality aspects** that are relevant to a computer science ${body.kind}.

For each assessment point, provide _strengths_ and _areas for improvement_ (if any).

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

function getReviewSystemPrompt(body?: ReviewBody) {
    const wipContext = body?.workInProgress
        ? `\nNote: This paper is a **work in progress**. The authors may be submitting an early or incomplete draft. Please weigh this context accordingly in your assessment.`
        : '';
    const pageContext = body?.hasPageLimit && body?.pageLimit
        ? `\nNote: The paper has a **page limit of ${body.pageLimit} pages** and is currently at **${body.currentPages ?? '?'} pages**.`
        : '';
    return `# ROLE AND GOAL
    ${wipContext}${pageContext}
You are a world-class, seasoned reviewer for a scientific computer science conference.
Your expertise spans computer science and software engineering, with a deep understanding of academic research methodologies and technical writing standards.

Be really honest, do not hold back critique if necessary.
Your analyses, feedback and suggestions must be helpful, they should be professional and in a constructive tone.
Your tone is critical but collegial, firm but fair.

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
--- -1 Weak reject - A borderline paper where the weaknesses slightly outweigh the strengths. I will not fight to reject it, but I lean towards rejection.
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

function getReviewMessagePart(body: ReviewBody): TextPart {
    return {
        type: 'text',
        text: `Analyze the provided ${body.kind}.
Use the review criteria and output format from the system prompt.
Present the final review that should be sent to the authors.
Be specific, honest, and constructive.`
    }
}

function getAseSystemPrompt(body?: ReviewBody) {
    const wipContext = body?.workInProgress
        ? `\nNote: This paper is a **work in progress**. Please weigh this context accordingly in your assessment.`
        : '';
    const pageContext = body?.hasPageLimit && body?.pageLimit
        ? `\nNote: The paper has a **page limit of ${body.pageLimit} pages** and is currently at **${body.currentPages ?? '?'} pages**.`
        : '';
    return `# ROLE AND GOAL
${wipContext}${pageContext}
You are a world-class, seasoned reviewer for the IEEE/ACM International Conference on Automated Software Engineering (ASE), specifically for the Industry Showcase track.
Your expertise spans automated software engineering, industrial practice, and the application of automation in real-world software systems.

Be really honest, do not hold back critique if necessary. Your analyses, feedback and suggestions must be helpful, professional, and in a constructive tone. Your tone is critical but collegial, firm but fair. You act as a mentor, aiming to elevate the quality of industrial contributions in the field.

Your primary goal is to provide a critical, insightful, and constructive review that serves two purposes:
1.  **For the Program Committee:** To help them make a fair and informed decision about whether to accept the paper, with a clear recommendation and robust justification based on the provided criteria.
2.  **For the Authors:** To provide clear, actionable feedback that helps them improve their current and future work, regardless of the acceptance decision. You are a mentor helping to elevate the quality of industrial science in the field.

You must operate within the conference's guiding principles:
- **Uphold Quality:** Champion technically sound, significant, and relevant industrial work.
- **Provide Clarity:** Deliver clear, well-justified feedback, especially for rejections.
- **Ensure Fairness:** Base your review strictly on the paper's content and the review criteria, avoiding personal bias.
- **Be Professional:** Maintain a respectful, collegial, and constructive tone at all times.

# CONTEXT
ASE is the premier research forum for Automated Software Engineering, bringing together academia and industry to discuss foundations, techniques, and tools for automating the analysis, design, implementation, testing, and maintenance of large software systems.

ASE welcomes submissions across the full spectrum of Automated Software Engineering, including but not limited to:
- Requirements and Design
- Testing and Analysis
- Maintenance and Evolution
- Human and Social Aspects
- AI and Software Engineering
- Software Analytics
- Formal Aspects of Software Engineering
- Security and Other Non-Functional Properties

Industry Showcase submissions should prioritize impact and realistic applications over novelty. Focus is on automation, useful tools, success stories, experience reports, and practical challenges.

# REVIEW CRITERIA
Evaluate the paper according to the following criteria:
- **Originality:** Does the paper advance the state of practice in its industrial context?
- **Relevance to Industrial Application:** Is the relevance to industry clear and well described?
- **Significance of Contributions:** How significant is the work compared to related works and similar industrial contexts?
- **Generalizability and Scalability:** Are the results applicable beyond the specific context?
- **Clarity:** Is the paper clearly written and well-structured?

# OUTPUT FORMAT
Use the following Markdown structure:

### Summary
[Brief summary of the paper and its industrial context.]

### Strengths
- [List major strengths, especially regarding industrial impact, automation, and practical relevance.]

### Weaknesses
- [List major weaknesses, e.g., lack of generalizability, unclear impact, insufficient evaluation, etc.]

### Detailed Comments
[Provide detailed, criterion-based comments. Reference the review criteria above.]

### Suggestions for Improvement
[List concrete, actionable suggestions for the authors.]

### Overall Recommendation
[Provide a clear recommendation (e.g., Strong Accept, Weak Accept, Borderline, Weak Reject, Strong Reject) and justify your decision based on the criteria above.]
`;
}

function getAseMessagePart() : TextPart {
    return {
        type: 'text',
        text: `Analyze the provided paper for the ASE 2025 Industry Showcase track.
Focus on industrial relevance, impact, and practical application.
Use the review criteria and output format from the system prompt.
Present the final review that should be sent to the authors.
Be specific, honest, and constructive.`
    };
}

function getSectionAnalysisSystemPrompt(body: SectionAnalysisBody) {
    return `You are an intelligent writing assistant for reviewing a computer science ${body.kind}.
You are proficient in computer science and software engineering, with expert knowledge in technical and scientific writing in the field of computer science.

You analyze one specific section in ${body.workInProgress ? "a work in progress, so keep this in mind. You can already suggest improvements for parts that are not yet implemented or marked with TODO." : "a completed work that is ready for review."}
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

function getNewFileFollowUpInstruction() {
    return `I have revised the paper based on your feedback. Here is the updated version. Please evaluate the changes, noting what has improved and whether any issues remain or new ones have emerged.`;
}

const followUpBodySchema = t.Object({
    apiKey: t.Optional(t.String()),
    model: t.Union([t.Literal("pro"), t.Literal("flash")]),
    systemPrompt: t.String(),
    conversationHistory: t.String(), // JSON: {role:'user'|'assistant', content:string}[]
    newFile: t.Optional(t.File()),   // option (a): complete new file version
    textMessage: t.Optional(t.String()), // option (b): free-text follow-up
})

type FollowUpBody = typeof followUpBodySchema.static

// Treat common placeholder values as absent so fallbacks work reliably
function normalizePrompt(value: any): string | undefined {
    if (value === undefined || value === null) return undefined;
    // If it's a non-string, leave it (rare)
    if (typeof value !== 'string') return value;
    const s = value.trim();
    if (s.length === 0) return undefined;
    const lower = s.toLowerCase();
    if (lower === 'undefined' || lower === 'null') return undefined;
    return value;
}

// Helper: resolve model identifier from request body
function getModelFromBody(body: { model?: "pro" | "flash" }) {
    if (body.model === "pro") return pro;
    return flash;
}

// Detailed logging helpers
function maskApiKey(key: string | undefined | null) {
    if (!key) return '(from env)';
    try {
        const s = String(key);
        if (s.length <= 8) return '****';
        return s.slice(0, 4) + '...' + s.slice(-4);
    } catch (e) {
        return '****';
    }
}

function truncate(s: string | undefined | null, max = 1000) {
    if (s === undefined || s === null) return String(s);
    const str = String(s);
    return str.length > max ? str.slice(0, max) + '...[truncated]' : str;
}

function safeStringify(obj: any, max = 2000) {
    try {
        const s = JSON.stringify(obj, null, 2);
        return s.length > max ? s.slice(0, max) + '...[truncated]' : s;
    } catch (e) {
        try {
            return String(obj);
        } catch (e2) {
            return '[unstringifiable]';
        }
    }
}

function logBeforeLLM(route: string, body: any, callMeta: { modelId: string, systemPrompt?: string, promptSummary?: string }) {
    const fileInfo = body?.file ? `fileName=${body.file?.name} fileType=${body.file?.type || 'unknown'} ` : '';
    console.log(`\n[LLM CALL START] route=${route}`);
    console.log(`Received: apiKey=${maskApiKey(body?.apiKey)} model=${body?.model} kind=${body?.kind} workInProgress=${body?.workInProgress} hasPageLimit=${body?.hasPageLimit} ${fileInfo}`);
    console.log(`LLM details: modelId=${callMeta.modelId}`);
    if (callMeta.systemPrompt) console.log(`System prompt (truncated):\n${truncate(callMeta.systemPrompt, 2000)}`);
    if (callMeta.promptSummary) console.log(`Prompt summary (truncated):\n${truncate(callMeta.promptSummary, 2000)}`);
}

// Make this async so we can read response bodies if necessary
function logAfterLLM(route: string, result: { text?: string; object?: unknown; usage?: { promptTokens?: number; completionTokens?: number }; finishReason?: string }) {
    console.log(
        `[LLM CALL END] route=${route}`,
        `finishReason=${result.finishReason ?? 'unknown'}`,
        `promptTokens=${result.usage?.promptTokens ?? '?'}`,
        `completionTokens=${result.usage?.completionTokens ?? '?'}`,
        `outputLength=${result.text ? String(result.text).length : result.object ? JSON.stringify(result.object).length : 0}`
    )
}

const app = new Elysia({
    serve: {
        // Increase idle timeout to 30 seconds
        idleTimeout: 255,
    },
})
    .use(cors())
    .use(swagger())
    .post("/overall_analysis_general",async ({body}) => {
        const route = '/overall_analysis_general';
        const modelId = getModelFromBody(body);
        const customSys = normalizePrompt(body.customSystemPrompt);
        const systemPrompt = customSys ?? getOverallAnalysisSystemPrompt(body);
        const customMsg = normalizePrompt(body.customMessagePart);
        const promptSummary = customMsg ?? getOverallGeneralAnalysisMessagePart(body).text;

        logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary });

        const result = await generateText({
            model: google(body.apiKey)(modelId),
            system: systemPrompt,
            prompt: [
                {
                    role: 'user',
                    content: [
                        customMsg ? { type: 'text', text: customMsg } : getOverallGeneralAnalysisMessagePart(body),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
            temperature: 0.7,
        });

        logAfterLLM(route, result);

        console.log("Overall analysis result:", JSON.stringify(result, null, 2));

        return result.text;
    }, {
        // type: "multipart/form-data",
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/overall_analysis_detailed", async ({body}) => {
        const route = '/overall_analysis_detailed';
        const modelId = getModelFromBody(body);
        const customSys = normalizePrompt(body.customSystemPrompt);
        const systemPrompt = customSys ?? getOverallAnalysisSystemPrompt(body);
        const customMsg = normalizePrompt(body.customMessagePart);
        const promptSummary = customMsg ?? getOverallDetailedAnalysisMessagePart(body).text;

        logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary });

        const result = await generateText({
            model: google(body.apiKey)(modelId),
            system: systemPrompt,
            prompt: [
                {
                    role: 'user',
                    content: [
                        customMsg ? { type: 'text', text: customMsg } : getOverallDetailedAnalysisMessagePart(body),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
            temperature: 0.7,
        });

        logAfterLLM(route, result);

        console.log("Overall analysis result:", JSON.stringify(result, null, 2));

        return result.text;
    }, {
        // type: "multipart/form-data",
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/section_analysis", async ({body}) => {
        const route = '/section_analysis';
        const modelId = getModelFromBody(body);
        const customSys = normalizePrompt(body.customSystemPrompt);
        const systemPrompt = customSys ?? getSectionAnalysisSystemPrompt(body);
        const customMsg = normalizePrompt(body.customMessagePart);
        const promptSummary = customMsg ?? getSectionAnalysisMessagePart(body).text;

        logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary });

        const result = await generateText({
            model: google(body.apiKey)(modelId),
            system: systemPrompt,
            prompt: [
                {
                    role: 'user',
                    content: [
                        customMsg ? { type: 'text', text: customMsg } : getSectionAnalysisMessagePart(body),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
            temperature: 0.7,
        });

        logAfterLLM(route, result);

        console.log("Section analysis result:", JSON.stringify(result, null, 2));

        return result.text;
    }, {
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: sectionAnalysisBodySchema,
        response: t.String(),
    })
    .post("/review", async ({body}) => {
        const route = '/review';
        const modelId = getModelFromBody(body);
        const customSys = normalizePrompt(body.customSystemPrompt);
        const systemPrompt = customSys ?? getReviewSystemPrompt(body);
        const customMsg = normalizePrompt(body.customMessagePart);
        const promptSummary = customMsg ?? getReviewMessagePart(body).text;

        logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary });

        const result = await generateText({
            model: google(body.apiKey)(modelId),
            system: systemPrompt,
            prompt: [
                {
                    role: 'user',
                    content: [
                        customMsg ? { type: 'text', text: customMsg } : getReviewMessagePart(body),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
            temperature: 0.7,
        });

        logAfterLLM(route, result);

        console.log("Review result:", JSON.stringify(result, null, 2));

        return result.text;
    }, {
        parse: 'multipart/form-data', // According to https://github.com/elysiajs/elysia/discussions/676
        body: reviewBodySchema,
        response: t.String(),
    })
    .post("/ase",async ({body}) => {
        const route = '/ase';
        const modelId = getModelFromBody(body);
        const customSys = normalizePrompt(body.customSystemPrompt);
        const systemPrompt = customSys ?? getAseSystemPrompt(body);
        const customMsg = normalizePrompt(body.customMessagePart);
        const promptSummary = customMsg ?? getAseMessagePart().text;

        logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary });

        const result = await generateText({
            model: google(body.apiKey)(modelId),
            system: systemPrompt,
            prompt: [
                {
                    role: 'user',
                    content: [
                        customMsg ? { type: 'text', text: customMsg } : getAseMessagePart(),
                        await createFileOrImageMessagePart(body.file)
                    ]
                }
            ],
            temperature: 0.7,
        });

        logAfterLLM(route, result);

        return result.text;
    }, {
        parse: 'multipart/form-data',
        body: reviewBodySchema,
        response: t.String(),
    })
    .post("/sections",async ({body}) => {
        const route = '/sections';
        const modelId = getModelFromBody(body);
        const systemPrompt = getSectionsSystemPrompt();

        logBeforeLLM(route, body, { modelId, systemPrompt, promptSummary: 'extract section titles using schema: SectionTitles' });

        const result = await generateObject({
            model: google(body.apiKey)(modelId),
            schemaName: "SectionTitles",
            schemaDescription: "A list of sections extracted from a document, including optional information about numbering and sub(sub)sections.",
            schema: z.array(zSectionSchema),
            system: systemPrompt,
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

        logAfterLLM(route, result);

        console.log("Sections result:", JSON.stringify(result, null, 2));

        return result.object
    }, {
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
    .post("/overall_general_analysis_message_part", ({body}) => {
        return getOverallGeneralAnalysisMessagePart(body).text;
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/overall_detailed_analysis_message_part", ({body}) => {
        return getOverallDetailedAnalysisMessagePart(body).text;
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.String(),
    })
    .post("/review_system_prompt", () => {
        return getReviewSystemPrompt(body);
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
    .post("/ase_system_prompt", () => {
        return getAseSystemPrompt(body);
    }, {
        response: t.String(),
    })
    .post("/ase_message_part", () => {
        return getAseMessagePart().text;
    }, {
        response: t.String(),
    })
    .post("/prompt/analysis/combined", ({body}) => {
        return {
            systemPrompt: getOverallAnalysisSystemPrompt(body),
            messagePart: getOverallGeneralAnalysisMessagePart(body).text
        };
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.Object({
            systemPrompt: t.String(),
            messagePart: t.String()
        }),
    })
    .post("/prompt/analysis-detailed/combined", ({body}) => {
        return {
            systemPrompt: getOverallAnalysisSystemPrompt(body),
            messagePart: getOverallDetailedAnalysisMessagePart(body).text
        };
    }, {
        parse: 'multipart/form-data',
        body: analysisBodySchema,
        response: t.Object({
            systemPrompt: t.String(),
            messagePart: t.String()
        }),
    })
    .post("/prompt/review/combined", ({body}) => {
        return {
            systemPrompt: getReviewSystemPrompt(body),
            messagePart: getReviewMessagePart(body).text
        };
    }, {
        parse: 'multipart/form-data',
        body: reviewBodySchema,
        response: t.Object({
            systemPrompt: t.String(),
            messagePart: t.String()
        }),
    })
    .post("/prompt/ase-review/combined", ({body}) => {
        return {
            systemPrompt: getAseSystemPrompt(body),
            messagePart: getAseMessagePart().text
        };
    }, {
        parse: 'multipart/form-data',
        body: reviewBodySchema,
        response: t.Object({
            systemPrompt: t.String(),
            messagePart: t.String()
        }),
    })
    .post("/follow_up", async ({body}) => {
        const route = '/follow_up';
        const modelId = getModelFromBody(body);

        // Parse conversation history (text-only messages)
        let history: { role: 'user' | 'assistant'; content: string }[] = [];
        try {
            history = JSON.parse(body.conversationHistory);
        } catch (e) {
            throw new Error('Invalid conversationHistory JSON');
        }

        // Build the new user turn content
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

        // All prior history is text-only; append new user turn
        const messages: any[] = [
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: newUserContent },
        ];

        const promptSummary = body.newFile
            ? `[New file version: ${body.newFile.name}]`
            : body.textMessage ?? '';

        logBeforeLLM(route, body, { modelId, systemPrompt: body.systemPrompt, promptSummary });

        const result = await generateText({
            model: google(body.apiKey)(modelId),
            system: body.systemPrompt,
            messages,
            temperature: 0.7,
        });

        logAfterLLM(route, result);

        return result.text;
    }, {
        parse: 'multipart/form-data',
        body: followUpBodySchema,
        response: t.String(),
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

type App = typeof app;

export type {App, Section}