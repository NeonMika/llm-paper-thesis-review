import { computed, type Ref, ref } from 'vue'
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
  const paperType: Ref<
    'full conference paper' | 'short conference paper' | 'journal paper' | 'bachelor thesis' | 'master thesis' | 'university seminar paper'
  > = ref('full conference paper')
  const hasPageLimit = ref(false)
  const pageLimit = ref(0)
  const currentPages = ref(0)

  const paperTypes = ref([
    { optionLabel: 'Full Conference Paper', optionValue: 'full conference paper' },
    { optionLabel: 'Short Conference Paper', optionValue: 'short conference paper' },
    { optionLabel: 'Journal Paper', optionValue: 'journal paper' },
    { optionLabel: 'Bachelor thesis', optionValue: 'bachelor thesis' },
    { optionLabel: 'Master thesis', optionValue: 'master thesis' },
    { optionLabel: 'University Seminar Paper', optionValue: 'university seminar paper' },
  ])

  // Google Gemini Settings
  const apiKey = ref<string>('');
  const model = ref<'pro' | 'flash'>('flash');

  // Input: a file from <input type="file">
  function readPaperFromFile(readFile: File | null) {
    if (!readFile) return

    /*
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

     */

    file.value = readFile
    content.value = "x"
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
    paperType.value = 'full conference paper'
    hasPageLimit.value = false
    pageLimit.value = 0
    currentPages.value = 0
  }

  async function getSectionTitles() {
    if (!file.value) return

    loadingSections.value = true
    const { data, error } = await api.sections.post({
      file: file.value,
      apiKey: apiKey.value || "",
      model: model.value,
    })
    loadingSections.value = false
    if (error) {
      sectionsError.value = error
      throw error
    }

    sections.value = data
  }

  async function getOverallAnalysisGeneral() {
    if (!file.value || !paperType.value) return

    loadingOverallAnalysis.value = true
    const { data, error } = await api.overall_analysis_general.post({
      file: file.value,
      kind: paperType.value,
      workInProgress: wip.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + '',
      currentPages: currentPages.value + '',
      apiKey: apiKey.value || "",
      model: model.value,
    })
    loadingOverallAnalysis.value = false
    if (error) {
      overallAnalysisError.value = error
      throw error
    }

    overallAnalysis.value = data
  }

  async function getOverallAnalysisDetailed() {
    if (!file.value || !paperType.value) return

    loadingOverallAnalysis.value = true
    const { data, error } = await api.overall_analysis_detailed.post({
      file: file.value,
      kind: paperType.value,
      workInProgress: wip.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + '',
      currentPages: currentPages.value + '',
      apiKey: apiKey.value || "",
      model: model.value,
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
    const { data, error } = await api.review.post({
      file: file.value,
      apiKey: apiKey.value || "",
      model: model.value,
      kind: paperType.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + '',
      currentPages: currentPages.value + '',
    })
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
      workInProgress: wip.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + "",
      currentPages: currentPages.value + "",
      apiKey: apiKey.value || "",
      model: model.value,
    })
    loadingSectionAnalysis.value = false
    if (error) {
      sectionAnalysisError.value = error
      throw error
    }
    sections.value.find((section) => section.title === sectionTitle)!.analysis = data
  }

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

    // Google Gemini Settings
    apiKey,
    model,

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
    getOverallAnalysisGeneral,
    getOverallAnalysisDetailed,
    getReview,
    enrichWithSectionAnalysis,

    // Errors
    sectionsError,
    overallAnalysisError,
    reviewError,
    sectionAnalysisError,

  }
})
