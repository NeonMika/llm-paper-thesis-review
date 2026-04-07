export const DEFAULT_FILE_FOLLOW_UP_INSTRUCTION =
  'I have revised the paper based on your feedback. Here is the updated version. Please evaluate the changes, noting what has improved and whether any issues remain or new ones have emerged.'

export type ReviewType = 'analysis' | 'analysis-detailed' | 'review' | 'ase-review'

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  'analysis': 'Paper Analysis (General)',
  'analysis-detailed': 'Paper Analysis (Detailed)',
  'review': 'Paper Review',
  'ase-review': 'ASE Paper Review',
}
