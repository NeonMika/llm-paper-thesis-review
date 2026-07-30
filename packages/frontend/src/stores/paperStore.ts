import { computed, watch, type Ref, ref } from 'vue'
import { defineStore } from 'pinia'

import api, { BASE_URL } from '../api'
import type { PaperKind, PublicationKind, Section, StudentWorkKind } from '../../../backend/src'
import {
  DEFAULT_FILE_FOLLOW_UP_INSTRUCTION,
  isReviewType,
  isReviewTypeCompatible,
} from '../constants'
import type { ReviewType } from '../constants'

export interface FollowUp {
  id: string
  timestamp: Date
  mode: 'file' | 'text'
  fileName?: string
  userMessage: string
  response: string
}

export interface Review {
  id: string
  type: ReviewType
  systemPrompt: string
  messagePart: string
  result: string
  timestamp: Date
  fileName: string
  fileContentPreview: string
  followUps: FollowUp[]
}

// Centralized list of text file extensions (previewable/readable as text)
const TEXT_FILE_EXTENSIONS = [
  '.txt',
  '.tex',
  '.md',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
]

export const usePaperStore = defineStore('paper', () => {
  const file = ref<File | null>(null)

  const content = ref('')
  const loadingContent = ref(false)

  type SectionWithAnalysis = Section & { analysis?: string }
  const sections: Ref<SectionWithAnalysis[]> = ref([])
  const sectionsError = ref<unknown>(null)
  const loadingSections = ref(false)

  const sectionAnalysisError = ref<unknown>(null)
  const loadingSectionAnalysisSet = ref<Set<string>>(new Set())
  const loadingSectionAnalysis = computed(() => loadingSectionAnalysisSet.value.size > 0)

  const loadingReview = ref(false)

  function isLoadingSectionAnalysis(sectionTitle: string): boolean {
    return loadingSectionAnalysisSet.value.has(sectionTitle)
  }

  const wip = ref(false)
  const paperType: Ref<PaperKind> = ref('full conference paper')
  const hasPageLimit = ref(false)
  const pageLimit = ref(1)
  const currentPages = ref(0)

  watch(pageLimit, (v) => {
    if (v < 0.5) pageLimit.value = 0.5
  })
  watch(currentPages, (v) => {
    if (v < 0) currentPages.value = 0
  })

  const paperTypes = ref([
    { optionLabel: 'Full Conference Paper', optionValue: 'full conference paper' },
    { optionLabel: 'Short Conference Paper', optionValue: 'short conference paper' },
    { optionLabel: 'Journal Paper', optionValue: 'journal paper' },
    { optionLabel: 'Bachelor thesis', optionValue: 'bachelor thesis' },
    { optionLabel: 'Master thesis', optionValue: 'master thesis' },
    { optionLabel: 'University Seminar Paper', optionValue: 'university seminar paper' },
  ])

  // Google Gemini Settings
  const apiKey = ref<string>('')
  const model = ref<'pro' | 'flash'>('flash')

  function getFileExtension(fileName: string): string {
    const idx = fileName.lastIndexOf('.')
    return idx >= 0 ? fileName.substring(idx) : ''
  }

  function isTextFileName(fileName: string): boolean {
    const lower = fileName.toLowerCase()
    return TEXT_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))
  }

  // Reviews management
  const reviews: Ref<Review[]> = ref([])
  const REVIEWS_STORAGE_KEY = 'llm-paper-reviews'

  // Load reviews from localStorage on initialization
  function loadReviewsFromStorage() {
    try {
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (!Array.isArray(parsed)) throw new Error('Stored reviews must be an array')
        // Convert timestamp strings back to Date objects
        reviews.value = parsed.flatMap((value: unknown) => {
          if (typeof value !== 'object' || value === null || !isReviewType(Reflect.get(value, 'type'))) {
            return []
          }
          const review = value as Review
          return [
            {
              ...review,
              timestamp: new Date(review.timestamp),
              followUps: (review.followUps ?? []).map((followUp: FollowUp) => ({
                ...followUp,
                timestamp: new Date(followUp.timestamp),
              })),
            },
          ]
        })
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
    type: ReviewType,
    systemPrompt: string,
    messagePart: string,
    result: string,
    reviewedFile: File,
  ) {
    const fileContentPreview = await extractFilePreview(reviewedFile)

    const review: Review = {
      id: crypto.randomUUID(),
      type,
      systemPrompt,
      messagePart,
      result,
      timestamp: new Date(),
      fileName: reviewedFile.name,
      fileContentPreview,
      followUps: [],
    }

    // Add to beginning (newest first)
    reviews.value.unshift(review)
    saveReviewsToStorage()
  }

  // Delete a specific review
  function deleteReview(id: string) {
    reviews.value = reviews.value.filter((r) => r.id !== id)
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
      apiKey: apiKey.value || '',
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
    type: ReviewType,
    customSystemPrompt?: string,
    customMessagePart?: string,
  ): Promise<string> {
    if (!file.value) throw new Error('File must be selected')
    if (!isReviewTypeCompatible(type, paperType.value)) {
      throw new Error(`Review type "${type}" is not compatible with ${paperType.value}.`)
    }

    // Build request body with optional custom prompt fields
    const requestBody: {
      file: File
      apiKey: string
      model: 'pro' | 'flash'
      kind: typeof paperType.value
      workInProgress: boolean
      hasPageLimit: boolean
      pageLimit: string
      currentPages: string
      customSystemPrompt?: string
      customMessagePart?: string
    } = {
      file: file.value,
      apiKey: apiKey.value || '',
      model: model.value,
      kind: paperType.value,
      workInProgress: wip.value,
      hasPageLimit: hasPageLimit.value,
      pageLimit: pageLimit.value + '',
      currentPages: currentPages.value + '',
    }

    if (customSystemPrompt?.trim()) {
      requestBody.customSystemPrompt = customSystemPrompt
    }
    if (customMessagePart?.trim()) {
      requestBody.customMessagePart = customMessagePart
    }

    const publicationRequestBody = {
      ...requestBody,
      kind: requestBody.kind as PublicationKind,
    }
    const studentWorkRequestBody = {
      ...requestBody,
      kind: requestBody.kind as StudentWorkKind,
    }
    const sendRequest = {
      'thesis-analysis': () => api.reviews['thesis-analysis'].post(studentWorkRequestBody),
      'thesis-analysis-detailed': () =>
        api.reviews['thesis-analysis-detailed'].post(studentWorkRequestBody),
      analysis: () => api.reviews.analysis.post(publicationRequestBody),
      'analysis-detailed': () => api.reviews['analysis-detailed'].post(publicationRequestBody),
      'review-critical': () => api.reviews['review-critical'].post(publicationRequestBody),
      review: () => api.reviews.review.post(publicationRequestBody),
      'review-guardian': () => api.reviews['review-guardian'].post(publicationRequestBody),
      'ase-review-critical': () => api.reviews['ase-review-critical'].post(publicationRequestBody),
      'ase-review': () => api.reviews['ase-review'].post(publicationRequestBody),
      'ase-review-guardian': () => api.reviews['ase-review-guardian'].post(publicationRequestBody),
    } satisfies Record<ReviewType, () => Promise<unknown>>

    loadingReview.value = true
    try {
      const { data, error } = await sendRequest[type]()
      if (error) throw error
      return data
    } finally {
      loadingReview.value = false
    }
  }

  async function enrichWithSectionAnalysis(sectionTitle: string) {
    if (!file.value || !sectionTitle || !paperType.value) return

    loadingSectionAnalysisSet.value = new Set(loadingSectionAnalysisSet.value).add(sectionTitle)
    try {
      const { data, error } = await api.section_analysis.post({
        file: file.value,
        sectionTitle: sectionTitle,
        kind: paperType.value,
        workInProgress: wip.value,
        hasPageLimit: hasPageLimit.value,
        pageLimit: pageLimit.value + '',
        currentPages: currentPages.value + '',
        apiKey: apiKey.value || '',
        model: model.value,
      })
      if (error) {
        sectionAnalysisError.value = error
        throw error
      }
      sections.value.find((section) => section.title === sectionTitle)!.analysis = data
    } finally {
      const next = new Set(loadingSectionAnalysisSet.value)
      next.delete(sectionTitle)
      loadingSectionAnalysisSet.value = next
    }
  }

  async function sendFollowUpRequest(
    reviewId: string,
    options: { mode: 'file' | 'text'; file?: File; textMessage?: string },
  ): Promise<void> {
    const review = reviews.value.find((r) => r.id === reviewId)
    if (!review) throw new Error('Review not found')

    // Build text-only conversation history from the review's conversation so far
    const history: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: review.messagePart },
      { role: 'assistant', content: review.result },
    ]
    for (const followUp of review.followUps) {
      history.push({ role: 'user', content: followUp.userMessage })
      history.push({ role: 'assistant', content: followUp.response })
    }

    // Always use FormData so the server's multipart/form-data parser never rejects the request,
    // regardless of whether a file is attached (Eden treaty sends JSON when no File is present).
    const formData = new FormData()
    formData.append('apiKey', apiKey.value || '')
    formData.append('model', model.value)
    formData.append('systemPrompt', review.systemPrompt)
    formData.append('conversationHistory', JSON.stringify(history))

    if (options.mode === 'file' && options.file) {
      formData.append('newFile', options.file)
      if (options.textMessage?.trim()) {
        formData.append('textMessage', options.textMessage)
      }
    } else if (options.mode === 'text' && options.textMessage?.trim()) {
      formData.append('textMessage', options.textMessage)
    } else {
      throw new Error('Either a file or a text message must be provided')
    }

    const response = await fetch(`${BASE_URL}/follow_up`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Request failed (${response.status}): ${errorText}`)
    }

    const responseText = await response.text()

    const followUp: FollowUp = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      mode: options.mode,
      fileName: options.mode === 'file' ? options.file?.name : undefined,
      userMessage:
        options.mode === 'text'
          ? (options.textMessage ?? '')
          : options.textMessage?.trim() || DEFAULT_FILE_FOLLOW_UP_INSTRUCTION,
      response: responseText,
    }

    review.followUps.push(followUp)
    saveReviewsToStorage()
  }

  // Computed property "loaded" is true if any loading boolean is true
  const loading = computed(() => {
    return (
      loadingContent.value ||
      loadingSections.value ||
      loadingSectionAnalysis.value ||
      loadingReview.value
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
    isLoadingSectionAnalysis,

    // Methods
    readPaperFromFile,
    getSectionTitles,
    sendReviewRequest,
    enrichWithSectionAnalysis,
    addReview,
    deleteReview,
    clearAllReviews,
    sendFollowUpRequest,

    // Errors
    sectionsError,
    sectionAnalysisError,
  }
})
