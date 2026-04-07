export function maskApiKey(key: string | undefined | null) {
    if (!key) return '(from env)';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '...' + key.slice(-4);
}

export function truncate(s: string | undefined | null, max = 1000) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max) + '...[truncated]' : s;
}

export function safeStringify(obj: unknown, max = 2000) {
    try {
        const s = JSON.stringify(obj, null, 2);
        return s.length > max ? s.slice(0, max) + '...[truncated]' : s;
    } catch {
        try {
            return String(obj);
        } catch {
            return '[unstringifiable]';
        }
    }
}

export function logBeforeLLM(
    route: string,
    body: { apiKey?: string; model?: string; kind?: string; workInProgress?: boolean; hasPageLimit?: boolean; file?: { name?: string; type?: string } },
    callMeta: { modelId: string; systemPrompt?: string; promptSummary?: string }
) {
    const fileInfo = body?.file
        ? `fileName=${body.file?.name} fileType=${body.file?.type || 'unknown'} `
        : '';
    console.log(`\n[LLM CALL START] route=${route}`);
    console.log(
        `Received: apiKey=${maskApiKey(body?.apiKey)} model=${body?.model} kind=${body?.kind} workInProgress=${body?.workInProgress} hasPageLimit=${body?.hasPageLimit} ${fileInfo}`
    );
    console.log(`LLM details: modelId=${callMeta.modelId}`);
    if (callMeta.systemPrompt)
        console.log(`System prompt (truncated):\n${truncate(callMeta.systemPrompt, 2000)}`);
    if (callMeta.promptSummary)
        console.log(`Prompt summary (truncated):\n${truncate(callMeta.promptSummary, 2000)}`);
}

export function logAfterLLM(
    route: string,
    result: {
        text?: string;
        object?: unknown;
        usage?: { inputTokens?: number; outputTokens?: number };
        finishReason?: string;
    }
) {
    console.log(
        `[LLM CALL END] route=${route}`,
        `finishReason=${result.finishReason ?? 'unknown'}`,
        `inputTokens=${result.usage?.inputTokens ?? '?'}`,
        `outputTokens=${result.usage?.outputTokens ?? '?'}`,
        `outputLength=${
            result.text
                ? String(result.text).length
                : result.object
                  ? JSON.stringify(result.object).length
                  : 0
        }`
    );
}
