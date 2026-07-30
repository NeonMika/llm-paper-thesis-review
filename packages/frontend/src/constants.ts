import type { PaperKind, ReviewType } from '../../backend/src'

export const DEFAULT_FILE_FOLLOW_UP_INSTRUCTION =
  'I have revised the paper based on your feedback. Here is the updated version. Please evaluate the changes, noting what has improved and whether any issues remain or new ones have emerged.'

export type { ReviewType }

export const REVIEW_TYPE_LABELS = {
  'thesis-analysis': 'Thesis Analysis (General)',
  'thesis-analysis-detailed': 'Thesis Analysis (Detailed)',
  analysis: 'Paper Analysis (General)',
  'analysis-detailed': 'Paper Analysis (Detailed)',
  'review-critical': 'Paper Review (Critical)',
  review: 'Paper Review (Balanced)',
  'review-guardian': 'Paper Review (Guardian)',
  'ase-review-critical': 'ASE Industry Showcase Review (Critical)',
  'ase-review': 'ASE Industry Showcase Review (Balanced)',
  'ase-review-guardian': 'ASE Industry Showcase Review (Guardian)',
} as const satisfies Record<ReviewType, string>

const STUDENT_WORK_REVIEW_TYPES = new Set<ReviewType>([
  'thesis-analysis',
  'thesis-analysis-detailed',
])

export const REVIEW_TYPE_OPTIONS = Object.entries(REVIEW_TYPE_LABELS) as [ReviewType, string][]

export function isReviewType(value: unknown): value is ReviewType {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(REVIEW_TYPE_LABELS, value)
  )
}

export function isReviewTypeCompatible(type: ReviewType, kind: PaperKind): boolean {
  const isStudentWork =
    kind === 'bachelor thesis' || kind === 'master thesis' || kind === 'university seminar paper'
  return STUDENT_WORK_REVIEW_TYPES.has(type) === isStudentWork
}
