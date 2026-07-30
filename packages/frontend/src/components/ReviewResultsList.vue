<template>
  <Card>
    <template #title>
      <div class="title-bar">
        <span>Review Results ({{ paperStore.reviews.length }})</span>
        <Button
          v-if="paperStore.reviews.length > 0"
          label="Clear All"
          @click="handleClearAll"
          severity="danger"
          size="small"
        />
      </div>
    </template>
    <template #content>
      <div v-if="paperStore.reviews.length === 0" class="empty-state">
        No reviews yet. Use the editor above to generate your first review.
      </div>
      <div v-else class="reviews-list">
        <div v-for="review in paperStore.reviews" :key="review.id" class="review-card">
          <div class="review-header" @click="toggleExpand(review.id)">
            <div class="review-info">
              <h3 class="review-title">{{ getReviewTypeLabel(review.type) }}</h3>
              <span class="review-meta">
                {{ review.fileName }} • {{ formatDate(review.timestamp) }}
              </span>
            </div>
            <div class="review-actions">
              <button
                class="icon-button"
                @click.stop="toggleExpand(review.id)"
                :title="isExpanded(review.id) ? 'Collapse' : 'Expand'"
              >
                {{ isExpanded(review.id) ? '▲' : '▼' }}
              </button>
              <button
                class="icon-button delete"
                @click.stop="handleDelete(review.id)"
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>

          <div v-if="isExpanded(review.id)" class="review-content">
            <!-- File Content Preview -->
            <div class="content-section">
              <div class="section-header">
                <h4>File</h4>
              </div>
              <div class="file-info">
                <strong>{{ review.fileName }}</strong>
                <pre v-if="review.fileContentPreview" class="file-preview">{{
                  review.fileContentPreview
                }}</pre>
                <span v-else class="no-preview">(Binary file - no preview available)</span>
              </div>
            </div>

            <!-- System Prompt -->
            <div class="content-section">
              <div class="section-header">
                <div class="header-with-button">
                  <h4>System Prompt</h4>
                  <button class="toggle-button" @click="togglePromptExpand(review.id, 'system')">
                    {{ isPromptExpanded(review.id, 'system') ? '▼ Show less' : '▶ Show more' }}
                  </button>
                </div>
              </div>
              <pre
                class="prompt-content"
                :class="{ collapsed: !isPromptExpanded(review.id, 'system') }"
                >{{ review.systemPrompt }}</pre
              >
            </div>

            <!-- Message Part -->
            <div class="content-section">
              <div class="section-header">
                <div class="header-with-button">
                  <h4>Message Part</h4>
                  <button class="toggle-button" @click="togglePromptExpand(review.id, 'message')">
                    {{ isPromptExpanded(review.id, 'message') ? '▼ Show less' : '▶ Show more' }}
                  </button>
                </div>
              </div>
              <pre
                class="prompt-content"
                :class="{ collapsed: !isPromptExpanded(review.id, 'message') }"
                >{{ review.messagePart }}</pre
              >
            </div>

            <!-- Result -->
            <div class="content-section">
              <div class="section-header">
                <div class="header-with-button">
                  <h4>Result</h4>
                  <button class="toggle-button" @click="toggleResultFormat(review.id)">
                    {{ isResultMarkdown(review.id) ? '▼ Show Formatted' : '▶ Show Markdown' }}
                  </button>
                  <button
                    v-if="isResultMarkdown(review.id)"
                    class="toggle-button"
                    @click="copyMarkdown(review.result)"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
              <div v-if="isResultMarkdown(review.id)" class="result-markdown">
                <pre>{{ review.result }}</pre>
              </div>
              <div v-else class="result-content" v-html="marked.parse(review.result)"></div>
            </div>

            <!-- Follow-up Conversation Thread -->
            <div v-for="followUp in review.followUps" :key="followUp.id" class="follow-up-thread">
              <!-- User turn -->
              <div class="thread-turn user-turn">
                <div class="turn-header">
                  <span
                    class="turn-badge"
                    :class="followUp.mode === 'file' ? 'badge-file' : 'badge-text'"
                  >
                    {{ followUp.mode === 'file' ? '📄 New File Version' : '💬 Text Follow-Up' }}
                  </span>
                  <span class="turn-meta">{{ formatDate(followUp.timestamp) }}</span>
                </div>
                <div class="turn-content user-content">
                  <strong v-if="followUp.fileName">{{ followUp.fileName }}</strong>
                  <p class="user-message">{{ followUp.userMessage }}</p>
                </div>
              </div>

              <!-- Assistant turn -->
              <div class="thread-turn assistant-turn">
                <div class="turn-header">
                  <span class="turn-badge badge-assistant">🤖 Response</span>
                  <div class="header-with-button">
                    <button class="toggle-button" @click="toggleFollowUpFormat(followUp.id)">
                      {{
                        isFollowUpMarkdown(followUp.id) ? '▼ Show Formatted' : '▶ Show Markdown'
                      }}
                    </button>
                    <button
                      v-if="isFollowUpMarkdown(followUp.id)"
                      class="toggle-button"
                      @click="copyMarkdown(followUp.response)"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div v-if="isFollowUpMarkdown(followUp.id)" class="result-markdown">
                  <pre>{{ followUp.response }}</pre>
                </div>
                <div v-else class="result-content" v-html="marked.parse(followUp.response)"></div>
              </div>
            </div>

            <!-- Follow-up Input Section -->
            <div class="follow-up-section">
              <h4 class="follow-up-title">Add Follow-Up</h4>

              <!-- Mode Selector -->
              <div class="mode-selector">
                <button
                  class="mode-button"
                  :class="{ active: getFollowUpMode(review.id) === 'text' }"
                  @click="setFollowUpMode(review.id, 'text')"
                >
                  💬 Text Message
                </button>
                <button
                  class="mode-button"
                  :class="{ active: getFollowUpMode(review.id) === 'file' }"
                  @click="setFollowUpMode(review.id, 'file')"
                >
                  📄 New File Version
                </button>
              </div>

              <!-- Text mode -->
              <template v-if="getFollowUpMode(review.id) === 'text'">
                <textarea
                  v-model="getFollowUpState(review.id).textMessage"
                  rows="4"
                  class="follow-up-textarea"
                  placeholder="e.g. I improved Section 3 as follows: ..."
                />
              </template>

              <!-- File mode -->
              <template v-else>
                <div class="file-mode-inputs">
                  <label class="file-input-label">
                    <span>Select revised paper file:</span>
                    <input
                      type="file"
                      class="hidden-file-input"
                      @change="onFollowUpFileChange(review.id, $event)"
                    />
                  </label>
                  <span v-if="getFollowUpState(review.id).file" class="selected-file-name">
                    ✓ {{ getFollowUpState(review.id).file!.name }}
                  </span>
                  <label class="textarea-label">Instruction for the reviewer (optional):</label>
                  <textarea
                    v-model="getFollowUpState(review.id).fileInstruction"
                    rows="3"
                    class="follow-up-textarea"
                    :placeholder="DEFAULT_FILE_FOLLOW_UP_INSTRUCTION"
                  />
                </div>
              </template>

              <div class="follow-up-actions">
                <Button
                  label="Send Follow-Up"
                  @click="sendFollowUp(review.id)"
                  :loading="isFollowUpLoading(review.id)"
                  :disabled="!canSendFollowUp(review.id)"
                />
              </div>
              <div v-if="getFollowUpError(review.id)" class="error-message">
                {{ getFollowUpError(review.id) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>

  <!-- Confirmation Modal -->
  <div v-if="showConfirmModal" class="modal-overlay" @click="cancelDelete">
    <div class="modal-content" @click.stop>
      <h3>{{ confirmModalTitle }}</h3>
      <p>{{ confirmModalMessage }}</p>
      <div class="modal-actions">
        <button class="modal-button secondary" @click="cancelDelete">Cancel</button>
        <button class="modal-button primary" @click="confirmDelete">Delete</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { marked } from 'marked'
import { usePaperStore } from '../stores/paperStore'
import {
  DEFAULT_FILE_FOLLOW_UP_INSTRUCTION,
  REVIEW_TYPE_LABELS,
  type ReviewType,
} from '../constants'

const paperStore = usePaperStore()

// Track expanded state for each review (only newest is expanded by default)
const expandedReviews = ref<Set<string>>(new Set())
const expandedPrompts = ref<Map<string, Set<'system' | 'message'>>>(new Map())
const resultShowMarkdown = ref<Map<string, boolean>>(new Map())

// Initialize first review as expanded
if (paperStore.reviews.length > 0) {
  expandedReviews.value.add(paperStore.reviews[0].id)
}

// Confirmation modal state
const showConfirmModal = ref(false)
const confirmModalTitle = ref('')
const confirmModalMessage = ref('')
const pendingDeleteId = ref<string | null>(null)
const isDeleteAll = ref(false)

function isExpanded(reviewId: string): boolean {
  return expandedReviews.value.has(reviewId)
}

function toggleExpand(reviewId: string) {
  if (expandedReviews.value.has(reviewId)) {
    expandedReviews.value.delete(reviewId)
  } else {
    expandedReviews.value.add(reviewId)
  }
}

function isPromptExpanded(reviewId: string, type: 'system' | 'message'): boolean {
  return expandedPrompts.value.get(reviewId)?.has(type) || false
}

function togglePromptExpand(reviewId: string, type: 'system' | 'message') {
  if (!expandedPrompts.value.has(reviewId)) {
    expandedPrompts.value.set(reviewId, new Set())
  }
  const prompts = expandedPrompts.value.get(reviewId)!
  if (prompts.has(type)) {
    prompts.delete(type)
  } else {
    prompts.add(type)
  }
}

function getReviewTypeLabel(type: ReviewType): string {
  return REVIEW_TYPE_LABELS[type] ?? type
}

function formatDate(date: Date): string {
  const d = new Date(date)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleDelete(reviewId: string) {
  pendingDeleteId.value = reviewId
  isDeleteAll.value = false
  confirmModalTitle.value = 'Delete Review'
  confirmModalMessage.value =
    'Are you sure you want to delete this review? This action cannot be undone.'
  showConfirmModal.value = true
}

function handleClearAll() {
  isDeleteAll.value = true
  confirmModalTitle.value = 'Clear All Reviews'
  confirmModalMessage.value =
    'Are you sure you want to delete all reviews? This action cannot be undone.'
  showConfirmModal.value = true
}

function confirmDelete() {
  if (isDeleteAll.value) {
    paperStore.clearAllReviews()
    expandedReviews.value.clear()
    expandedPrompts.value.clear()
  } else if (pendingDeleteId.value) {
    paperStore.deleteReview(pendingDeleteId.value)
    expandedReviews.value.delete(pendingDeleteId.value)
    expandedPrompts.value.delete(pendingDeleteId.value)
  }
  showConfirmModal.value = false
  pendingDeleteId.value = null
  isDeleteAll.value = false
}

function cancelDelete() {
  showConfirmModal.value = false
  pendingDeleteId.value = null
  isDeleteAll.value = false
}

function isResultMarkdown(reviewId: string): boolean {
  return resultShowMarkdown.value.get(reviewId) || false
}

function toggleResultFormat(reviewId: string) {
  const current = resultShowMarkdown.value.get(reviewId) || false
  resultShowMarkdown.value.set(reviewId, !current)
}

async function copyMarkdown(markdown: string) {
  try {
    await navigator.clipboard.writeText(markdown)
    // Could add a toast notification here if desired
  } catch (err) {
    console.error('Failed to copy markdown:', err)
  }
}

// --- Follow-up state ---

interface FollowUpState {
  mode: 'file' | 'text'
  file: File | null
  fileInstruction: string
  textMessage: string
}

const followUpStates = reactive<Record<string, FollowUpState>>({})
const followUpLoading = reactive<Record<string, boolean>>({})
const followUpErrors = reactive<Record<string, string>>({})
const followUpMarkdownMap = reactive<Record<string, boolean>>({})

function getFollowUpState(reviewId: string): FollowUpState {
  if (!followUpStates[reviewId]) {
    followUpStates[reviewId] = {
      mode: 'text',
      file: null,
      fileInstruction: '',
      textMessage: '',
    }
  }
  return followUpStates[reviewId]
}

function getFollowUpMode(reviewId: string): 'file' | 'text' {
  return getFollowUpState(reviewId).mode
}

function setFollowUpMode(reviewId: string, mode: 'file' | 'text') {
  getFollowUpState(reviewId).mode = mode
}

function onFollowUpFileChange(reviewId: string, event: Event) {
  const input = event.target as HTMLInputElement
  getFollowUpState(reviewId).file = input.files?.[0] ?? null
}

function isFollowUpLoading(reviewId: string): boolean {
  return followUpLoading[reviewId] || false
}

function getFollowUpError(reviewId: string): string {
  return followUpErrors[reviewId] || ''
}

function canSendFollowUp(reviewId: string): boolean {
  const state = getFollowUpState(reviewId)
  if (state.mode === 'file') return !!state.file
  return !!state.textMessage?.trim()
}

function isFollowUpMarkdown(followUpId: string): boolean {
  return followUpMarkdownMap[followUpId] || false
}

function toggleFollowUpFormat(followUpId: string) {
  followUpMarkdownMap[followUpId] = !followUpMarkdownMap[followUpId]
}

async function sendFollowUp(reviewId: string) {
  const state = getFollowUpState(reviewId)
  followUpLoading[reviewId] = true
  followUpErrors[reviewId] = ''

  try {
    if (state.mode === 'file' && state.file) {
      await paperStore.sendFollowUpRequest(reviewId, {
        mode: 'file',
        file: state.file,
        textMessage: state.fileInstruction || undefined,
      })
      state.file = null
      state.fileInstruction = ''
    } else if (state.mode === 'text') {
      await paperStore.sendFollowUpRequest(reviewId, {
        mode: 'text',
        textMessage: state.textMessage,
      })
      state.textMessage = ''
    }
  } catch (err) {
    followUpErrors[reviewId] = `Failed to send follow-up: ${err}`
  } finally {
    followUpLoading[reviewId] = false
  }
}
</script>

<style scoped>
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-style: italic;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.review-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}

.review-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #bfdbfe;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  cursor: pointer;
  transition: background 0.2s;
}

.review-header:hover {
  background: #f3f4f6;
}

.review-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.review-title {
  margin: 0;
  font-size: 1.1rem;
  color: #1f2937;
}

.review-meta {
  font-size: 0.85rem;
  color: #9ca3af;
}

.review-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-button {
  padding: 0.5rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
  transition: transform 0.2s;
}

.icon-button:hover {
  transform: scale(1.1);
}

.icon-button.delete:hover {
  color: #dc2626;
}

.review-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0;
}

.header-with-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #374151;
  white-space: nowrap;
}

.result-actions {
  display: flex;
  gap: 0.5rem;
}

.toggle-button {
  padding: 0.35rem 0.85rem;
  border: 1.5px solid #bfdbfe;
  border-radius: 6px;
  background: linear-gradient(90deg, #f0f9ff 0%, #eff6ff 100%);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  color: #1e40af;
  font-weight: 500;
}

.toggle-button:hover {
  background: linear-gradient(90deg, #dbeafe 0%, #e0f2fe 100%);
  border-color: #60a5fa;
}

.toggle-button:active {
  transform: scale(0.98);
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-preview {
  padding: 0.75rem;
  background: linear-gradient(90deg, #faf5ff 0%, #f5f3ff 100%);
  border: 1.5px solid #d8b4fe;
  border-radius: 8px;
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  color: #7c3aed;
  box-shadow: 0 1px 4px 0 rgba(124, 58, 237, 0.08);
}

.no-preview {
  color: #9ca3af;
  font-style: italic;
}

.prompt-content {
  padding: 0.75em 1em;
  background: linear-gradient(90deg, #faf5ff 0%, #f5f3ff 100%);
  border: 1.5px solid #d8b4fe;
  border-radius: 8px;
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  transition: max-height 0.3s;
  color: #7c3aed;
  box-shadow: 0 1px 4px 0 rgba(124, 58, 237, 0.08);
}

.prompt-content.collapsed {
  max-height: 150px;
  overflow: hidden;
  position: relative;
}

.prompt-content.collapsed::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: linear-gradient(transparent, #f5f3ff);
}

.result-content {
  padding: 0.85em 1.1em;
  background: linear-gradient(90deg, #f0fdf4 0%, #f0fdfa 100%);
  border: 1.5px solid #a7f3d0;
  border-radius: 8px;
  line-height: 1.6;
  color: #065f46;
  box-shadow: 0 1px 4px 0 rgba(16, 185, 129, 0.08);
  font-size: 1.02em;
}

.result-markdown {
  padding: 0.75em 1em;
  background: linear-gradient(90deg, #ecfdf5 0%, #f0fdfa 100%);
  border: 1.5px solid #a7f3d0;
  border-radius: 8px;
  box-shadow: 0 1px 4px 0 rgba(16, 185, 129, 0.08);
}

.result-markdown pre {
  margin: 0;
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #065f46;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
}

.modal-content h3 {
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1.5rem;
}

.modal-content p {
  margin: 0 0 1.5rem 0;
  color: #6b7280;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.modal-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-button.secondary {
  background: #d1d5db;
  color: #1f2937;
}

.modal-button.secondary:hover {
  background: #9ca3af;
}

.modal-button.primary {
  background: #dc2626;
  color: white;
}

.modal-button.primary:hover {
  background: #b91c1c;
}

/* Follow-up thread styles */
.follow-up-thread {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-left: 3px solid #bfdbfe;
  padding-left: 1rem;
  margin-top: 0.5rem;
}

.thread-turn {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.turn-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.turn-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-text {
  background: #dbeafe;
  color: #1e40af;
}

.badge-file {
  background: #dcfce7;
  color: #166534;
}

.badge-assistant {
  background: #f3f4f6;
  color: #374151;
}

.turn-meta {
  font-size: 0.8rem;
  color: #9ca3af;
}

.user-content {
  padding: 0.6rem 0.85rem;
  background: #f0f9ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-message {
  margin: 0;
  font-size: 0.95rem;
  color: #1e3a5f;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Follow-up input section */
.follow-up-section {
  border-top: 2px dashed #e5e7eb;
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.follow-up-title {
  margin: 0;
  font-size: 1rem;
  color: #374151;
}

.mode-selector {
  display: flex;
  gap: 0.5rem;
}

.mode-button {
  padding: 0.4rem 0.9rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
  color: #6b7280;
  transition: all 0.15s;
}

.mode-button:hover {
  border-color: #93c5fd;
  color: #1e40af;
}

.mode-button.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #1e40af;
  font-weight: 600;
}

.follow-up-textarea {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  box-sizing: border-box;
  color: #1f2937;
  transition: border-color 0.15s;
}

.follow-up-textarea:focus {
  outline: none;
  border-color: #60a5fa;
}

.file-mode-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-input-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: #374151;
}

.hidden-file-input {
  width: 100%;
  padding: 0.4rem;
  border: 1.5px dashed #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.hidden-file-input:hover {
  border-color: #93c5fd;
}

.selected-file-name {
  font-size: 0.85rem;
  color: #166534;
  font-weight: 500;
}

.textarea-label {
  font-size: 0.85rem;
  color: #6b7280;
}

.follow-up-actions {
  display: flex;
  justify-content: flex-start;
}

.error-message {
  padding: 0.5rem 0.75rem;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.9rem;
}
</style>
