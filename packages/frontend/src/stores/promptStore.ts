import { ref, watch, computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import api from '../api'
import { usePaperStore } from './paperStore.ts'

export const usePromptStore = defineStore('promptStore', () => {
  // Section analysis prompts (still used by Section Titles card)
  const sectionAnalysisSystemPrompt = ref<Record<string, string>>({})
  const sectionAnalysisMessagePart = ref<Record<string, string>>({})
  const sectionsSystemPrompt = ref('')

  // Errors for section prompts
  const sectionAnalysisSystemPromptError = ref<unknown | null>(null)
  const sectionAnalysisMessagePartError = ref<unknown | null>(null)
  const sectionsSystemPromptError = ref<unknown | null>(null)

  // Combined prompts for editor
  const currentSystemPrompt = ref('')
  const currentMessagePart = ref('')
  const originalSystemPrompt = ref('')
  const originalMessagePart = ref('')
  const combinedPromptError = ref<unknown | null>(null)

  const paperStore = usePaperStore()
  const {
    file,
    paperType,
    wip,
    hasPageLimit,
    pageLimit,
    currentPages,
    apiKey,
    model,
    sections
  } = storeToRefs(paperStore)

  // Section analysis prompts (still used by Section Titles feature)
  async function fetchSectionAnalysisSystemPrompt(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) {
      sectionAnalysisSystemPromptError.value = `fetchSectionAnalysisSystemPrompt: file, sectionTitle und paperType müssen gesetzt sein. file: ${!!file.value}, sectionTitle: ${!!sectionTitle}, paperType: ${!!paperType.value}`
      return
    }
    try {
      const { data, error } = await api.section_analysis_system_prompt.post({
        file: file.value,
        sectionTitle : sectionTitle,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + "",
        currentPages: currentPages.value + "",
        apiKey: apiKey.value || "",
        model: model.value,
      })
      if (error) throw error
      sectionAnalysisSystemPrompt.value = {
        ...sectionAnalysisSystemPrompt.value,
        [sectionTitle]: data
      }
      sectionAnalysisSystemPromptError.value = null
    } catch (err) {
      sectionAnalysisSystemPromptError.value = err
    }
  }

  async function fetchSectionAnalysisMessagePart(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) {
      sectionAnalysisMessagePartError.value = `fetchSectionAnalysisMessagePart: file, sectionTitle und paperType müssen gesetzt sein. file: ${!!file.value}, sectionTitle: ${!!sectionTitle}, paperType: ${!!paperType.value}`
      return
    }
    try {
      const { data, error } = await api.section_analysis_message_part.post({
        file: file.value,
        sectionTitle,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + "",
        currentPages: currentPages.value + "",
        apiKey: apiKey.value || "",
        model: model.value,
      })
      if (error) throw error
      sectionAnalysisMessagePart.value = {
        ...sectionAnalysisMessagePart.value,
        [sectionTitle]: data
      }
      sectionAnalysisMessagePartError.value = null
    } catch (err) {
      sectionAnalysisMessagePartError.value = err
    }
  }

  async function fetchSectionsSystemPrompt() {
    // keine Voraussetzungen
    try {
      const { data, error } = await api.sections_system_prompt.get()
      if (error) throw error
      sectionsSystemPrompt.value = data
      sectionsSystemPromptError.value = null
    } catch (err) {
      sectionsSystemPromptError.value = err
    }
  }

  // Combined prompt fetchers for ReviewPromptEditor
  async function fetchCombinedAnalysisPrompt() {
    if (!file.value || !paperType.value) {
      combinedPromptError.value = 'File and paper type must be set'
      return
    }
    try {
      // @ts-expect-error - API endpoint exists but types not yet regenerated
      const { data, error } = await api['prompt/analysis/combined'].post({
        file: file.value,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
        apiKey: apiKey.value || "",
        model: model.value,
      })
      if (error) throw error
      currentSystemPrompt.value = data.systemPrompt
      currentMessagePart.value = data.messagePart
      originalSystemPrompt.value = data.systemPrompt
      originalMessagePart.value = data.messagePart
      combinedPromptError.value = null
    } catch (err) {
      combinedPromptError.value = err
    }
  }

  async function fetchCombinedAnalysisDetailedPrompt() {
    if (!file.value || !paperType.value) {
      combinedPromptError.value = 'File and paper type must be set'
      return
    }
    try {
      // @ts-expect-error - API endpoint exists but types not yet regenerated
      const { data, error } = await api['prompt/analysis-detailed/combined'].post({
        file: file.value,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
        apiKey: apiKey.value || "",
        model: model.value,
      })
      if (error) throw error
      currentSystemPrompt.value = data.systemPrompt
      currentMessagePart.value = data.messagePart
      originalSystemPrompt.value = data.systemPrompt
      originalMessagePart.value = data.messagePart
      combinedPromptError.value = null
    } catch (err) {
      combinedPromptError.value = err
    }
  }

  async function fetchCombinedReviewPrompt() {
    if (!file.value) {
      combinedPromptError.value = 'File must be set'
      return
    }
    try {
      // @ts-expect-error - API endpoint exists but types not yet regenerated
      const { data, error } = await api['prompt/review/combined'].post({
        file: file.value,
        apiKey: apiKey.value || "",
        model: model.value,
        kind: paperType.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
      })
      if (error) throw error
      currentSystemPrompt.value = data.systemPrompt
      currentMessagePart.value = data.messagePart
      originalSystemPrompt.value = data.systemPrompt
      originalMessagePart.value = data.messagePart
      combinedPromptError.value = null
    } catch (err) {
      combinedPromptError.value = err
    }
  }

  async function fetchCombinedAseReviewPrompt() {
    if (!file.value) {
      combinedPromptError.value = 'File must be set'
      return
    }
    try {
      // @ts-expect-error - API endpoint exists but types not yet regenerated
      const { data, error } = await api['prompt/ase-review/combined'].post({
        file: file.value,
        apiKey: apiKey.value || "",
        model: model.value,
        kind: paperType.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
      })
      if (error) throw error
      currentSystemPrompt.value = data.systemPrompt
      currentMessagePart.value = data.messagePart
      originalSystemPrompt.value = data.systemPrompt
      originalMessagePart.value = data.messagePart
      combinedPromptError.value = null
    } catch (err) {
      combinedPromptError.value = err
    }
  }

  // Load prompts by review type
  async function loadPromptsForType(type: string) {
    if (!type) return

    try {
      switch (type) {
        case 'analysis':
          await fetchCombinedAnalysisPrompt()
          break
        case 'analysis-detailed':
          await fetchCombinedAnalysisDetailedPrompt()
          break
        case 'review':
          await fetchCombinedReviewPrompt()
          break
        case 'ase-review':
          await fetchCombinedAseReviewPrompt()
          break
      }
    } catch (err) {
      combinedPromptError.value = err
    }
  }

  // Computed property to check if prompts have been modified
  const isDirty = computed(() => {
    return currentSystemPrompt.value !== originalSystemPrompt.value ||
           currentMessagePart.value !== originalMessagePart.value
  })

  // Reset current prompts to original
  function resetToOriginal() {
    currentSystemPrompt.value = originalSystemPrompt.value
    currentMessagePart.value = originalMessagePart.value
  }

  // Watcher for section prompts (still needed for Section Titles feature)
  watch([file, paperType, wip, hasPageLimit, pageLimit, currentPages, sections], async () => {
    if (!sections.value.length) return
    for (const section of sections.value) {
      if (section.title) {
        await fetchSectionAnalysisSystemPrompt(section.title)
        await fetchSectionAnalysisMessagePart(section.title)
      }
    }
  }, { immediate: true })

  fetchSectionsSystemPrompt()

  return {
    // Section prompts (still used by Section Titles card)
    sectionAnalysisSystemPrompt,
    sectionAnalysisMessagePart,
    sectionsSystemPrompt,

    // Combined prompts for editor
    currentSystemPrompt,
    currentMessagePart,
    originalSystemPrompt,
    originalMessagePart,
    isDirty,
    combinedPromptError,

    // Section errors
    sectionAnalysisSystemPromptError,
    sectionAnalysisMessagePartError,
    sectionsSystemPromptError,

    // Methods
    fetchSectionAnalysisSystemPrompt,
    fetchSectionAnalysisMessagePart,
    fetchSectionsSystemPrompt,
    fetchCombinedAnalysisPrompt,
    fetchCombinedAnalysisDetailedPrompt,
    fetchCombinedReviewPrompt,
    fetchCombinedAseReviewPrompt,
    loadPromptsForType,
    resetToOriginal,
  }
})
