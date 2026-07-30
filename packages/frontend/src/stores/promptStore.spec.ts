import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePaperStore } from './paperStore'
import { usePromptStore } from './promptStore'

const apiMocks = vi.hoisted(() => ({
  promptPost: vi.fn(),
  sectionsGet: vi.fn(),
}))

vi.mock('../api', () => ({
  default: {
    prompts: new Proxy(
      {},
      {
        get: (_target, reviewType: string) => ({
          post: (body: unknown) => apiMocks.promptPost(reviewType, body),
        }),
      },
    ),
    sections_system_prompt: {
      get: apiMocks.sectionsGet,
    },
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('promptStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    apiMocks.promptPost.mockReset()
    apiMocks.sectionsGet.mockReset()
    apiMocks.sectionsGet.mockResolvedValue({ data: 'sections prompt', error: null })
  })

  it('loads the literal endpoint for the selected ReviewType with prompt context only', async () => {
    apiMocks.promptPost.mockResolvedValue({
      data: { systemPrompt: 'guardian system', messagePart: 'guardian message' },
      error: null,
    })
    const paperStore = usePaperStore()
    paperStore.paperType = 'full conference paper'
    paperStore.wip = true
    paperStore.hasPageLimit = true
    paperStore.pageLimit = 80
    paperStore.currentPages = 72
    const promptStore = usePromptStore()

    await expect(promptStore.loadPromptsForType('review-guardian')).resolves.toBe(true)

    expect(apiMocks.promptPost).toHaveBeenCalledWith('review-guardian', {
      kind: 'full conference paper',
      workInProgress: true,
      hasPageLimit: true,
      pageLimit: '80',
      currentPages: '72',
    })
    expect(promptStore.loadedReviewType).toBe('review-guardian')
    expect(promptStore.currentSystemPrompt).toBe('guardian system')
  })

  it('ignores a stale response from the previously selected ReviewType', async () => {
    const first = deferred<{
      data: { systemPrompt: string; messagePart: string }
      error: null
    }>()
    const second = deferred<{
      data: { systemPrompt: string; messagePart: string }
      error: null
    }>()
    apiMocks.promptPost.mockImplementation((reviewType: string) =>
      reviewType === 'analysis' ? first.promise : second.promise,
    )
    const paperStore = usePaperStore()
    paperStore.paperType = 'full conference paper'
    const promptStore = usePromptStore()

    const firstLoad = promptStore.loadPromptsForType('analysis')
    const secondLoad = promptStore.loadPromptsForType('review-critical')

    second.resolve({
      data: { systemPrompt: 'critical system', messagePart: 'critical message' },
      error: null,
    })
    await expect(secondLoad).resolves.toBe(true)

    first.resolve({
      data: { systemPrompt: 'stale system', messagePart: 'stale message' },
      error: null,
    })
    await expect(firstLoad).resolves.toBe(false)

    expect(promptStore.loadedReviewType).toBe('review-critical')
    expect(promptStore.currentSystemPrompt).toBe('critical system')
    expect(promptStore.currentMessagePart).toBe('critical message')
  })

  it('rejects a response when review settings changed while it was loading', async () => {
    const pending = deferred<{
      data: { systemPrompt: string; messagePart: string }
      error: null
    }>()
    apiMocks.promptPost.mockReturnValue(pending.promise)
    const paperStore = usePaperStore()
    paperStore.paperType = 'master thesis'
    paperStore.wip = false
    const promptStore = usePromptStore()

    const load = promptStore.loadPromptsForType('thesis-analysis')
    paperStore.wip = true
    pending.resolve({
      data: { systemPrompt: 'stale system', messagePart: 'stale message' },
      error: null,
    })

    await expect(load).resolves.toBe(false)
    expect(promptStore.loadedReviewType).toBeNull()
    expect(promptStore.currentSystemPrompt).toBe('')
    expect(promptStore.combinedPromptError).toContain('settings changed')
  })

  it('cancels an in-flight response when the review type is cleared', async () => {
    const pending = deferred<{
      data: { systemPrompt: string; messagePart: string }
      error: null
    }>()
    apiMocks.promptPost.mockReturnValue(pending.promise)
    const paperStore = usePaperStore()
    paperStore.paperType = 'journal paper'
    const promptStore = usePromptStore()

    const load = promptStore.loadPromptsForType('analysis')
    promptStore.cancelPromptLoad()
    pending.resolve({
      data: { systemPrompt: 'late system', messagePart: 'late message' },
      error: null,
    })

    await expect(load).resolves.toBe(false)
    expect(promptStore.loadedReviewType).toBeNull()
    expect(promptStore.currentSystemPrompt).toBe('')
    expect(promptStore.isLoadingPrompt).toBe(false)
  })

  it('keeps the last valid prompts but exposes preview errors', async () => {
    apiMocks.promptPost
      .mockResolvedValueOnce({
        data: { systemPrompt: 'loaded system', messagePart: 'loaded message' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { status: 500, value: 'failed' } })
    const paperStore = usePaperStore()
    paperStore.paperType = 'journal paper'
    const promptStore = usePromptStore()

    await expect(promptStore.loadPromptsForType('analysis')).resolves.toBe(true)
    await expect(promptStore.loadPromptsForType('analysis-detailed')).resolves.toBe(false)

    expect(promptStore.loadedReviewType).toBe('analysis')
    expect(promptStore.currentSystemPrompt).toBe('loaded system')
    expect(promptStore.combinedPromptError).toContain('Failed to load prompts')
  })

  it('preserves edited prompts until a reload succeeds', async () => {
    apiMocks.promptPost.mockResolvedValueOnce({
      data: { systemPrompt: 'original system', messagePart: 'original message' },
      error: null,
    })
    const pending = deferred<{
      data: null
      error: { status: number; value: string }
    }>()
    apiMocks.promptPost.mockReturnValueOnce(pending.promise)
    const paperStore = usePaperStore()
    paperStore.paperType = 'journal paper'
    const promptStore = usePromptStore()

    await promptStore.loadPromptsForType('analysis')
    promptStore.currentSystemPrompt = 'edited system'
    const reload = promptStore.loadPromptsForType('analysis')

    expect(promptStore.currentSystemPrompt).toBe('edited system')
    pending.resolve({ data: null, error: { status: 500, value: 'failed' } })
    await expect(reload).resolves.toBe(false)
    expect(promptStore.currentSystemPrompt).toBe('edited system')
    expect(promptStore.isDirty).toBe(true)
  })
})
