import { ref, watch, computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import api from '../api'
import { usePaperStore } from './paperStore.ts'
import type { PublicationKind, StudentWorkKind } from '../../../backend/src'
import { isReviewTypeCompatible, type ReviewType } from '../constants'

export const usePromptStore = defineStore('promptStore', () => {
  // Section analysis prompts (still used by Section Titles card)
  const sectionAnalysisSystemPrompt = ref<Record<string, string>>({})
  const sectionAnalysisMessagePart = ref<Record<string, string>>({})
  const sectionsSystemPrompt = ref('')

  // Errors for section prompts
  const sectionAnalysisSystemPromptError = ref<unknown>(null)
  const sectionAnalysisMessagePartError = ref<unknown>(null)
  const sectionsSystemPromptError = ref<unknown>(null)

  // Review prompt editor state
  const currentSystemPrompt = ref('')
  const currentMessagePart = ref('')
  const originalSystemPrompt = ref('')
  const originalMessagePart = ref('')
  const combinedPromptError = ref('')
  const isLoadingPrompt = ref(false)
  const loadedReviewType = ref<ReviewType | null>(null)
  let latestPromptRequest = 0

  const paperStore = usePaperStore()
  const { file, paperType, wip, hasPageLimit, pageLimit, currentPages, apiKey, model, sections } =
    storeToRefs(paperStore)

  // Section analysis prompts (still used by Section Titles feature)
  async function fetchSectionAnalysisSystemPrompt(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) {
      sectionAnalysisSystemPromptError.value = `fetchSectionAnalysisSystemPrompt: file, sectionTitle and paperType must be set. file: ${!!file.value}, sectionTitle: ${!!sectionTitle}, paperType: ${!!paperType.value}`
      return
    }
    try {
      const { data, error } = await api.section_analysis_system_prompt.post({
        file: file.value,
        sectionTitle,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
        apiKey: apiKey.value || '',
        model: model.value,
      })
      if (error) throw error
      sectionAnalysisSystemPrompt.value = {
        ...sectionAnalysisSystemPrompt.value,
        [sectionTitle]: data,
      }
      sectionAnalysisSystemPromptError.value = null
    } catch (err) {
      sectionAnalysisSystemPromptError.value = err
    }
  }

  async function fetchSectionAnalysisMessagePart(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) {
      sectionAnalysisMessagePartError.value = `fetchSectionAnalysisMessagePart: file, sectionTitle and paperType must be set. file: ${!!file.value}, sectionTitle: ${!!sectionTitle}, paperType: ${!!paperType.value}`
      return
    }
    try {
      const { data, error } = await api.section_analysis_message_part.post({
        file: file.value,
        sectionTitle,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
        apiKey: apiKey.value || '',
        model: model.value,
      })
      if (error) throw error
      sectionAnalysisMessagePart.value = {
        ...sectionAnalysisMessagePart.value,
        [sectionTitle]: data,
      }
      sectionAnalysisMessagePartError.value = null
    } catch (err) {
      sectionAnalysisMessagePartError.value = err
    }
  }

  async function fetchSectionsSystemPrompt() {
    try {
      const { data, error } = await api.sections_system_prompt.get()
      if (error) throw error
      sectionsSystemPrompt.value = data
      sectionsSystemPromptError.value = null
    } catch (err) {
      sectionsSystemPromptError.value = err
    }
  }

  function clearLoadedPrompts() {
    currentSystemPrompt.value = ''
    currentMessagePart.value = ''
    originalSystemPrompt.value = ''
    originalMessagePart.value = ''
    loadedReviewType.value = null
  }

  function cancelPromptLoad() {
    latestPromptRequest += 1
    isLoadingPrompt.value = false
    combinedPromptError.value = ''
    clearLoadedPrompts()
  }

  function applyLoadedPrompts(
    data: { systemPrompt: string; messagePart: string },
    type: ReviewType,
  ) {
    currentSystemPrompt.value = data.systemPrompt
    currentMessagePart.value = data.messagePart
    originalSystemPrompt.value = data.systemPrompt
    originalMessagePart.value = data.messagePart
    loadedReviewType.value = type
    combinedPromptError.value = ''
  }

  function formatPromptError(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  function getPromptContext() {
    return {
      kind: paperType.value,
      workInProgress: wip.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + '',
      currentPages: currentPages.value + '',
    }
  }

  function isCurrentPromptContext(context: ReturnType<typeof getPromptContext>): boolean {
    const currentContext = getPromptContext()
    return Object.keys(context).every(
      (key) =>
        context[key as keyof typeof context] === currentContext[key as keyof typeof currentContext],
    )
  }

  async function loadPromptsForType(type: ReviewType): Promise<boolean> {
    if (!paperType.value) {
      clearLoadedPrompts()
      combinedPromptError.value = 'Paper type must be set before loading prompts.'
      return false
    }
    if (!isReviewTypeCompatible(type, paperType.value)) {
      combinedPromptError.value = `Review type "${type}" is not compatible with ${paperType.value}.`
      return false
    }

    const requestId = ++latestPromptRequest
    isLoadingPrompt.value = true
    combinedPromptError.value = ''
    const promptContext = getPromptContext()
    const publicationPromptContext = {
      ...promptContext,
      kind: promptContext.kind as PublicationKind,
    }
    const studentWorkPromptContext = {
      ...promptContext,
      kind: promptContext.kind as StudentWorkKind,
    }
    const fetchPrompt = {
      'thesis-analysis': () => api.prompts['thesis-analysis'].post(studentWorkPromptContext),
      'thesis-analysis-detailed': () =>
        api.prompts['thesis-analysis-detailed'].post(studentWorkPromptContext),
      analysis: () => api.prompts.analysis.post(publicationPromptContext),
      'analysis-detailed': () => api.prompts['analysis-detailed'].post(publicationPromptContext),
      'review-critical': () => api.prompts['review-critical'].post(publicationPromptContext),
      review: () => api.prompts.review.post(publicationPromptContext),
      'review-guardian': () => api.prompts['review-guardian'].post(publicationPromptContext),
      'ase-review-critical': () =>
        api.prompts['ase-review-critical'].post(publicationPromptContext),
      'ase-review': () => api.prompts['ase-review'].post(publicationPromptContext),
      'ase-review-guardian': () =>
        api.prompts['ase-review-guardian'].post(publicationPromptContext),
    } satisfies Record<ReviewType, () => Promise<unknown>>

    try {
      const { data, error } = await fetchPrompt[type]()

      if (requestId !== latestPromptRequest) return false
      if (error) throw error
      if (!isCurrentPromptContext(promptContext)) {
        combinedPromptError.value =
          'Review settings changed while prompts were loading. Reload the prompts.'
        return false
      }

      applyLoadedPrompts(data, type)
      return true
    } catch (err) {
      if (requestId === latestPromptRequest) {
        combinedPromptError.value = `Failed to load prompts: ${formatPromptError(err)}`
      }
      return false
    } finally {
      if (requestId === latestPromptRequest) {
        isLoadingPrompt.value = false
      }
    }
  }

  const isDirty = computed(() => {
    return (
      currentSystemPrompt.value !== originalSystemPrompt.value ||
      currentMessagePart.value !== originalMessagePart.value
    )
  })

  function resetToOriginal() {
    currentSystemPrompt.value = originalSystemPrompt.value
    currentMessagePart.value = originalMessagePart.value
  }

  // Watcher for section prompts (still needed for Section Titles feature)
  watch(
    [file, paperType, wip, hasPageLimit, pageLimit, currentPages, sections],
    async () => {
      if (!sections.value.length) return
      await Promise.all(
        sections.value.flatMap((section) =>
          section.title
            ? [
                fetchSectionAnalysisSystemPrompt(section.title),
                fetchSectionAnalysisMessagePart(section.title),
              ]
            : [],
        ),
      )
    },
    { immediate: true },
  )

  fetchSectionsSystemPrompt()

  return {
    // Section prompts (still used by Section Titles card)
    sectionAnalysisSystemPrompt,
    sectionAnalysisMessagePart,
    sectionsSystemPrompt,

    // Review prompt editor state
    currentSystemPrompt,
    currentMessagePart,
    isDirty,
    combinedPromptError,
    isLoadingPrompt,
    loadedReviewType,

    // Section errors
    sectionAnalysisSystemPromptError,
    sectionAnalysisMessagePartError,
    sectionsSystemPromptError,

    // Methods
    fetchSectionAnalysisSystemPrompt,
    fetchSectionAnalysisMessagePart,
    fetchSectionsSystemPrompt,
    loadPromptsForType,
    cancelPromptLoad,
    resetToOriginal,
  }
})
