import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { REVIEW_TYPE_OPTIONS } from '../constants'
import { usePaperStore } from './paperStore'

const apiMocks = vi.hoisted(() => ({
  reviewPost: vi.fn(),
}))

vi.mock('../api', () => ({
  BASE_URL: 'http://localhost:3000',
  default: {
    reviews: new Proxy(
      {},
      {
        get: (_target, reviewType: string) => ({
          post: (body: unknown) => apiMocks.reviewPost(reviewType, body),
        }),
      },
    ),
  },
}))

describe('paperStore review requests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    apiMocks.reviewPost.mockReset()
    apiMocks.reviewPost.mockResolvedValue({ data: 'review result', error: null })
  })

  it('sends every ReviewType to its matching literal execution endpoint', async () => {
    const paperStore = usePaperStore()
    paperStore.file = new File(['paper'], 'paper.txt', { type: 'text/plain' })

    for (const [reviewType] of REVIEW_TYPE_OPTIONS) {
      paperStore.paperType = reviewType.startsWith('thesis-')
        ? 'master thesis'
        : 'full conference paper'

      await expect(paperStore.sendReviewRequest(reviewType)).resolves.toBe('review result')
      expect(apiMocks.reviewPost).toHaveBeenLastCalledWith(
        reviewType,
        expect.objectContaining({ kind: paperStore.paperType, file: paperStore.file }),
      )
    }
  })

  it('rejects an incompatible ReviewType before making a request', async () => {
    const paperStore = usePaperStore()
    paperStore.file = new File(['paper'], 'paper.txt', { type: 'text/plain' })
    paperStore.paperType = 'master thesis'

    await expect(paperStore.sendReviewRequest('review')).rejects.toThrow('not compatible')
    expect(apiMocks.reviewPost).not.toHaveBeenCalled()
  })

  it('ignores persisted reviews with unknown review types', () => {
    const storedReview = {
      id: 'review-1',
      systemPrompt: 'system',
      messagePart: 'message',
      result: 'result',
      timestamp: '2026-07-10T10:00:00.000Z',
      fileName: 'paper.txt',
      fileContentPreview: 'paper',
      followUps: [],
    }
    localStorage.setItem(
      'llm-paper-reviews',
      JSON.stringify([
        { ...storedReview, type: 'analysis' },
        { ...storedReview, id: 'unknown', type: 'future-review-type' },
      ]),
    )

    const paperStore = usePaperStore()

    expect(paperStore.reviews).toHaveLength(1)
    expect(paperStore.reviews[0].type).toBe('analysis')
    expect(paperStore.reviews[0].timestamp).toBeInstanceOf(Date)
  })
})
