import { computed, type Ref, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import api from '../api'
import type { Section } from '../../../backend/src'

export const usePaperStore = defineStore('paper', () => {
  const file = ref<File | null>(null)

  const content = ref('')
  const loadingContent = ref(false)

  type SectionWithAnalysis = Section & { analysis?: string }
  const sections: Ref<SectionWithAnalysis[]> = ref([])
  const sectionsError = ref<unknown | null>(null)
  const loadingSections = ref(false)

  const overallAnalysis = ref('')
  const overallAnalysisError = ref<unknown | null>(null)
  const loadingOverallAnalysis = ref(false)

  const review = ref('')
  const reviewError = ref<unknown | null>(null)
  const loadingReview = ref(false)

  const sectionAnalysisError = ref<unknown | null>(null)
  const loadingSectionAnalysis = ref(false)

  const wip = ref(false)
  const paperType: Ref<'full paper' | 'short paper' | 'bachelor thesis' | 'master thesis'> =
    ref('full paper')
  const hasPageLimit = ref(false)
  const pageLimit = ref(0)
  const currentPages = ref(0)

  const paperTypes = ref([
    { optionLabel: 'Full Paper', optionValue: 'full paper' },
    { optionLabel: 'Short Paper', optionValue: 'short paper' },
    { optionLabel: 'Bachelor thesis', optionValue: 'bachelor thesis' },
    { optionLabel: 'Master thesis', optionValue: 'master thesis' },
  ])

  // Input: a file from <input type="file">
  function readPaperFromFile(readFile: File | null) {
    if (!readFile) return

    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        _resetCalcs()
        file.value = readFile
        content.value = event.target.result as string
      }
    }
    loadingContent.value = true
    reader.readAsText(readFile)
  }

  function _reset() {
    _resetCalcs()
    _resetUserSettings()
  }

  function _resetCalcs() {
    file.value = null
    content.value = ''
    sections.value = []
    overallAnalysis.value = ''
    review.value = ''
    sectionsError.value = null
    overallAnalysisError.value = null
    reviewError.value = null
    sectionAnalysisError.value = null
    loadingContent.value = false
    loadingSections.value = false
    loadingOverallAnalysis.value = false
    loadingReview.value = false
    loadingSectionAnalysis.value = false
  }

  function _resetUserSettings() {
    wip.value = false
    paperType.value = 'full paper'
    hasPageLimit.value = false
    pageLimit.value = 0
    currentPages.value = 0
  }

  async function getSectionTitles() {
    if (!file.value) return

    loadingSections.value = true
    const { data, error } = await api.sections.post({ file: file.value })
    loadingSections.value = false
    if (error) {
      sectionsError.value = error
      throw error
    }

    sections.value = data
  }

  async function getOverallAnalysis() {
    if (!file.value || !paperType.value) return

    loadingOverallAnalysis.value = true
    const { data, error } = await api.overall_analysis.post({
      file: file.value,
      kind: paperType.value,
      workInProgress: wip.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + '',
      currentPages: currentPages.value + '',
    })
    loadingOverallAnalysis.value = false
    if (error) {
      overallAnalysisError.value = error
      throw error
    }

    overallAnalysis.value = data
  }

  async function getReview() {
    if (!file.value) return

    loadingReview.value = true
    const { data, error } = await api.review.post({ file: file.value })
    loadingReview.value = false
    if (error) {
      reviewError.value = error
      throw error
    }

    review.value = data
  }

  async function enrichWithSectionAnalysis(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) return

    loadingSectionAnalysis.value = true
    const { data, error } = await api.section_analysis.post({
      file: file.value,
      sectionTitle: sectionTitle,
      kind: paperType.value,
    })
    loadingSectionAnalysis.value = false
    if (error) {
      sectionAnalysisError.value = error
      throw error
    }
    sections.value.find((section) => section.title === sectionTitle)!.analysis = data
  }

  // Prompts & Message Parts
  const overallAnalysisSystemPrompt = ref('')
  const overallAnalysisMessagePart = ref('')
  const reviewSystemPrompt = ref('')
  const reviewMessagePart = ref('')
  const sectionAnalysisSystemPrompt = ref('')
  const sectionAnalysisMessagePart = ref('')
  const sectionsSystemPrompt = ref('')

  async function fetchOverallAnalysisSystemPrompt() {
    if (!file.value || !paperType.value) return
    try {
      const { data, error } = await api.overall_analysis_system_prompt.post({
        file: file.value,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
      })
      if (error) throw error
      overallAnalysisSystemPrompt.value = data
    } catch (err) {
      overallAnalysisError.value = err
    }
  }

  async function fetchOverallAnalysisMessagePart() {
    if (!file.value || !paperType.value) return
    try {
      const { data, error } = await api.overall_analysis_message_part.post({
        file: file.value,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
      })
      if (error) throw error
      overallAnalysisMessagePart.value = data.text
    } catch (err) {
      overallAnalysisError.value = err
    }
  }

  async function fetchReviewSystemPrompt() {
    // kein Feld notwendig
    try {
      const { data, error } = await api.review_system_prompt.post()
      if (error) throw error
      reviewSystemPrompt.value = data
    } catch (err) {
      reviewError.value = err
    }
  }

  async function fetchReviewMessagePart() {
    // kein Feld notwendig
    try {
      const { data, error } = await api.review_message_part.post()
      if (error) throw error
      reviewMessagePart.value = data.text
    } catch (err) {
      reviewError.value = err
    }
  }

  async function fetchSectionAnalysisSystemPrompt(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) return
    try {
      const { data, error } = await api.section_analysis_system_prompt.post({
        file: file.value,
        sectionTitle,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + "",
        currentPages: currentPages.value + "",
      })
      if (error) throw error
      sectionAnalysisSystemPrompt.value = data
    } catch (err) {
      sectionAnalysisError.value = err
    }
  }

  async function fetchSectionAnalysisMessagePart(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) return
    try {
      const { data, error } = await api.section_analysis_message_part.post({
        file: file.value,
        sectionTitle,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + "",
        currentPages: currentPages.value + "",
      })
      if (error) throw error
      sectionAnalysisMessagePart.value = data.text
    } catch (err) {
      sectionAnalysisError.value = err
    }
  }

  async function fetchSectionsSystemPrompt() {
    // kein Feld notwendig
    try {
      const { data, error } = await api.sections_system_prompt.get()
      if (error) throw error
      sectionsSystemPrompt.value = data
    } catch (err) {
      sectionsError.value = err
    }
  }

  // Automatisches Laden der Prompts & Message Parts, wenn alle nötigen Werte gesetzt sind
  watch([file, paperType, wip, hasPageLimit, pageLimit, currentPages], async () => {
    await fetchOverallAnalysisSystemPrompt()
    await fetchOverallAnalysisMessagePart()
  })

  watch([file, paperType, wip, hasPageLimit, pageLimit, currentPages, sections], async () => {
    if (sections.value.length === 0) return
    await fetchSectionAnalysisSystemPrompt(sections.value[0].title)
    await fetchSectionAnalysisMessagePart(sections.value[0].title)
  })

  fetchSectionsSystemPrompt()
  fetchReviewSystemPrompt()
  fetchReviewMessagePart()

  // Computed property "loaded" is true if any loading boolean is true
  const loading = computed(() => {
    return (
      loadingContent.value ||
      loadingSections.value ||
      loadingOverallAnalysis.value ||
      loadingReview.value ||
      loadingSectionAnalysis.value
    )
  })

  return {
    // Base data
    paperTypes,

    // Paper data
    file,
    content,
    sections,
    overallAnalysis,
    review,
    wip,
    paperType,
    hasPageLimit,
    pageLimit,
    currentPages,

    // Loading indicators
    loading,
    loadingContent,
    loadingSections,
    loadingOverallAnalysis,
    loadingReview,
    loadingSectionAnalysis,

    // Methods
    readPaperFromFile,
    getSectionTitles,
    getOverallAnalysis,
    getReview,
    enrichWithSectionAnalysis,
    // Prompts & Message Parts
    overallAnalysisSystemPrompt,
    overallAnalysisMessagePart,
    reviewSystemPrompt,
    reviewMessagePart,
    sectionAnalysisSystemPrompt,
    sectionAnalysisMessagePart,
    sectionsSystemPrompt,
    fetchOverallAnalysisSystemPrompt,
    fetchOverallAnalysisMessagePart,
    fetchReviewSystemPrompt,
    fetchReviewMessagePart,
    fetchSectionAnalysisSystemPrompt,
    fetchSectionAnalysisMessagePart,
    fetchSectionsSystemPrompt,

    // Errors
    sectionsError,
    overallAnalysisError,
    reviewError,
    sectionAnalysisError,
  }
})
