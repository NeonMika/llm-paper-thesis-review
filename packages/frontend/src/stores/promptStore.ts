import { ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import api from '../api'
import { usePaperStore } from './paperStore.ts'

export const usePromptStore = defineStore('promptStore', () => {
  const overallAnalysisSystemPrompt = ref('')
  const overallGeneralAnalysisMessagePart = ref('')
  const overallDetailedAnalysisMessagePart = ref('')
  const reviewSystemPrompt = ref('')
  const reviewMessagePart = ref('')
  // Für jede Section ein Prompt/MessagePart
  const sectionAnalysisSystemPrompt = ref<Record<string, string>>({})
  const sectionAnalysisMessagePart = ref<Record<string, string>>({})
  const sectionsSystemPrompt = ref('')

  // Separate Fehler für jede Fetch-Funktion
  const overallAnalysisSystemPromptError = ref<unknown | null>(null)
  const overallGeneralAnalysisMessagePartError = ref<unknown | null>(null)
  const overallDetailedAnalysisMessagePartError = ref<unknown | null>(null)
  const reviewSystemPromptError = ref<unknown | null>(null)
  const reviewMessagePartError = ref<unknown | null>(null)
  // Nur jeweils ein Fehler für die zuletzt abgefragte Section
  const sectionAnalysisSystemPromptError = ref<unknown | null>(null)
  const sectionAnalysisMessagePartError = ref<unknown | null>(null)
  const sectionsSystemPromptError = ref<unknown | null>(null)

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

  async function fetchOverallAnalysisSystemPrompt() {
    if (!file.value || !paperType.value) {
      overallAnalysisSystemPromptError.value = `fetchOverallAnalysisSystemPrompt: file and paperType müssen gesetzt sein. file: ${!!file.value}, paperType: ${!!paperType.value}`
      return
    }
    try {
      const { data, error } = await api.overall_analysis_system_prompt.post({
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
      overallAnalysisSystemPrompt.value = data
      overallAnalysisSystemPromptError.value = null
    } catch (err) {
      overallAnalysisSystemPromptError.value = err
    }
  }

  async function fetchGeneralOverallAnalysisMessagePart() {
    console.log('fetchGeneralOverallAnalysisMessagePart called')
    if (!file.value || !paperType.value) {
      overallGeneralAnalysisMessagePartError.value = `fetchGeneralOverallAnalysisMessagePart: file und paperType müssen gesetzt sein. file: ${!!file.value}, paperType: ${!!paperType.value}`
      return
    }
    try {
      const { data, error } = await api.overall_general_analysis_message_part.post({
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
      overallGeneralAnalysisMessagePart.value = data
      overallGeneralAnalysisMessagePartError.value = null
    } catch (err) {
      overallGeneralAnalysisMessagePartError.value = err
    }
  }

  async function fetchOverallAnalysisDetailedMessagePart() {
    if (!file.value || !paperType.value) {
      overallDetailedAnalysisMessagePartError.value = `fetchOverallAnalysisDetailedMessagePart: file und paperType müssen gesetzt sein. file: ${!!file.value}, paperType: ${!!paperType.value}`
      return
    }
    try {
      const { data, error } = await api.overall_detailed_analysis_message_part.post({
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
      overallDetailedAnalysisMessagePart.value = data
      overallDetailedAnalysisMessagePartError.value = null
    } catch (err) {
      overallDetailedAnalysisMessagePartError.value = err
    }
  }

  async function fetchReviewSystemPrompt() {
    // keine Voraussetzungen
    try {
      const { data, error } = await api.review_system_prompt.post()
      if (error) throw error
      reviewSystemPrompt.value = data
      reviewSystemPromptError.value = null
    } catch (err) {
      reviewSystemPromptError.value = err
    }
  }

  async function fetchReviewMessagePart() {
    if (!file.value) {
      reviewMessagePartError.value = `fetchReviewMessagePart: file muss gesetzt sein. file: ${!!file.value}`
      return
    }
    try {
      const { data, error } = await api.review_message_part.post({
        file: file.value,
        apiKey: apiKey.value || "",
        model: model.value,
        kind: paperType.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
      })
      if (error) throw error
      reviewMessagePart.value = data
      reviewMessagePartError.value = null
    } catch (err) {
      reviewMessagePartError.value = err
    }
  }

  // Nur jeweils ein Fehler für die zuletzt abgefragte Section
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

  // Automatisches Laden der Prompts & Message Parts, wenn alle nötigen Werte gesetzt sind
  watch([file, paperType, wip, hasPageLimit, pageLimit, currentPages], async () => {
    await fetchOverallAnalysisSystemPrompt()
    await fetchGeneralOverallAnalysisMessagePart()
    await fetchOverallAnalysisDetailedMessagePart()
    await fetchReviewSystemPrompt()
    await fetchReviewMessagePart()
  }, { immediate: true })

  // Für alle Sections Prompts/MessageParts laden
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
    // Prompts & Message Parts
    overallAnalysisSystemPrompt,
    overallGeneralAnalysisMessagePart,
    overallDetailedAnalysisMessagePart,
    reviewSystemPrompt,
    reviewMessagePart,
    sectionAnalysisSystemPrompt,
    sectionAnalysisMessagePart,
    sectionsSystemPrompt,

    // Fehler (separat für jede Fetch-Funktion)
    overallAnalysisSystemPromptError,
    overallGeneralAnalysisMessagePartError,
    overallDetailedAnalysisMessagePartError,
    reviewSystemPromptError,
    reviewMessagePartError,
    sectionAnalysisSystemPromptError,
    sectionAnalysisMessagePartError,
    sectionsSystemPromptError,

    // Methoden
    fetchOverallAnalysisSystemPrompt,
    fetchGeneralOverallAnalysisMessagePart,
    fetchOverallAnalysisDetailedMessagePart,
    fetchReviewSystemPrompt,
    fetchReviewMessagePart,
    fetchSectionAnalysisSystemPrompt,
    fetchSectionAnalysisMessagePart,
    fetchSectionsSystemPrompt,
  }
})
