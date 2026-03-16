import { computed, type Ref, ref } from 'vue'
import { defineStore } from 'pinia'

import api from '../api'
import type { Section } from '../../../backend/src'

export interface Review {
  id: string
  type: string
  systemPrompt: string
  messagePart: string
  result: string
  timestamp: Date
  fileName: string
  fileContentPreview: string
}

export const usePaperStore = defineStore('paper', () => {
  const file = ref<File | null>(null)

  const content = ref('')
  const loadingContent = ref(false)

  type SectionWithAnalysis = Section & { analysis?: string }
  const sections: Ref<SectionWithAnalysis[]> = ref([])
  const sectionsError = ref<unknown | null>(null)
  const loadingSections = ref(false)

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

  // Centralized list of text file extensions (previewable/readable as text)
  const TEXT_FILE_EXTENSIONS = [
    '.txt', '.tex', '.md', '.html', '.css', '.js', '.ts',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp'
  ]

  function getFileExtension(fileName: string): string {
    const idx = fileName.lastIndexOf('.')
    return idx >= 0 ? fileName.substring(idx) : ''
  }

  function isTextFileName(fileName: string): boolean {
    const lower = fileName.toLowerCase()
    return TEXT_FILE_EXTENSIONS.some(ext => lower.endsWith(ext))
  }

  // Reviews management
  const reviews: Ref<Review[]> = ref([])
  const REVIEWS_STORAGE_KEY = 'llm-paper-reviews'

  // Load reviews from localStorage on initialization
  function loadReviewsFromStorage() {
    try {
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Convert timestamp strings back to Date objects
        reviews.value = parsed.map((r: Review) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        }))
      }
    } catch (error) {
      console.error('Failed to load reviews from localStorage:', error)
      reviews.value = []
    }
  }

  // Save reviews to localStorage
  function saveReviewsToStorage() {
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews.value))
    } catch (error) {
      console.error('Failed to save reviews to localStorage:', error)
    }
  }

  // Helper to extract file preview (first 50 lines for text; message for non-text)
  async function extractFilePreview(file: File): Promise<string> {
    const name = file.name
    const ext = getFileExtension(name)
    const isText = isTextFileName(name)

    if (!isText) {
      return ext
        ? `Text preview not available for ${ext} file`
        : 'Text preview not available for this file'
    }

    try {
      const text = await file.text()
      const lines = text.split('\n')
      const preview = lines.slice(0, 50).join('\n')
      return preview + (lines.length > 50 ? '\n... (truncated)' : '')
    } catch (error) {
      console.error('Failed to read file content:', error)
      return 'Text preview could not be loaded'
    }
  }

  // Add a new review
  async function addReview(
    type: string,
    systemPrompt: string,
    messagePart: string,
    result: string
  ) {
    const fileContentPreview = file.value ? await extractFilePreview(file.value) : ''

    const review: Review = {
      id: crypto.randomUUID(),
      type,
      systemPrompt,
      messagePart,
      result,
      timestamp: new Date(),
      fileName: file.value?.name || 'Unknown file',
      fileContentPreview
    }

    // Add to beginning (newest first)
    reviews.value.unshift(review)
    saveReviewsToStorage()
  }

  // Delete a specific review
  function deleteReview(id: string) {
    reviews.value = reviews.value.filter(r => r.id !== id)
    saveReviewsToStorage()
  }

  // Clear all reviews
  function clearAllReviews() {
    reviews.value = []
    saveReviewsToStorage()
  }

  // Initialize reviews from storage
  loadReviewsFromStorage()


  // Input: a file from <input type="file">; only load text content for text files
  async function readPaperFromFile(readFile: File | null) {
    if (!readFile) return

    file.value = readFile
    const name = readFile.name
    const ext = getFileExtension(name)
    const isText = isTextFileName(name)

    if (!isText) {
      // Do not attempt to read non-text files (e.g., PDFs); show a helpful message instead
      content.value = ext
        ? `Text preview not available for ${ext} file`
        : 'Text preview not available for this file'
      loadingContent.value = false
      return
    }

    try {
      loadingContent.value = true
      const text = await readFile.text()
      content.value = text
    } catch (error) {
      console.error('Failed to read file content:', error)
      content.value = 'Text preview could not be loaded'
    } finally {
      loadingContent.value = false
    }
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

  async function sendReviewRequest(
    type: 'analysis' | 'analysis-detailed' | 'review' | 'ase-review',
    customSystemPrompt?: string,
    customMessagePart?: string
  ): Promise<string> {
    if (!file.value) throw new Error('File must be selected')

    // Build request bodies conditionally to avoid sending the literal string "undefined"
    const analysisRequestBody: any = {
      file: file.value,
      apiKey: apiKey.value || "",
      model: model.value,
      kind: paperType.value,
      workInProgress: wip.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + '',
      currentPages: currentPages.value + ''
    }

    if (customSystemPrompt !== undefined && customSystemPrompt !== null && String(customSystemPrompt).trim() !== '') {
      analysisRequestBody.customSystemPrompt = customSystemPrompt
    }
    if (customMessagePart !== undefined && customMessagePart !== null && String(customMessagePart).trim() !== '') {
      analysisRequestBody.customMessagePart = customMessagePart
    }

    const reviewRequestBody: any = {
      file: file.value,
      apiKey: apiKey.value || "",
      model: model.value,
      kind: paperType.value,
    }

    if (customSystemPrompt !== undefined && customSystemPrompt !== null && String(customSystemPrompt).trim() !== '') {
      reviewRequestBody.customSystemPrompt = customSystemPrompt
    }
    if (customMessagePart !== undefined && customMessagePart !== null && String(customMessagePart).trim() !== '') {
      reviewRequestBody.customMessagePart = customMessagePart
    }

    try {
      let result = ''
      switch (type) {
        case 'analysis':
          {
            const { data, error } = await api.overall_analysis_general.post(analysisRequestBody)
            if (error) throw error
            result = data
          }
          break
        case 'analysis-detailed':
          {
            const { data, error } = await api.overall_analysis_detailed.post(analysisRequestBody)
            if (error) throw error
            result = data
          }
          break
        case 'review':
          {
            const { data, error } = await api.review.post(reviewRequestBody)
            if (error) throw error
            result = data
          }
          break
        case 'ase-review':
          {
            const { data, error } = await api.ase.post(reviewRequestBody)
            if (error) throw error
            result = data
          }
          break
      }
      return result
    } catch (error) {
      // Error is propagated to caller
      throw error
    }
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
    wip,
    paperType,
    hasPageLimit,
    pageLimit,
    currentPages,

    // Google Gemini Settings
    apiKey,
    model,

    // Reviews
    reviews,

    // Loading indicators
    loading,
    loadingContent,
    loadingSections,
    loadingSectionAnalysis,

    // Methods
    readPaperFromFile,
    getSectionTitles,
    sendReviewRequest,
    enrichWithSectionAnalysis,
    addReview,
    deleteReview,
    clearAllReviews,

    // Errors
    sectionsError,
    sectionAnalysisError,

  }
})
