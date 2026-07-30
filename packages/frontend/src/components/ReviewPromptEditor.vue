<template>
  <div class="review-editor">
    <!-- File Status Warning -->
    <div v-if="!paperStore.file" class="warning-message">
      ⚠️ Please upload a paper file above before using the review editor.
    </div>

    <!-- Review Type Selector -->
    <div class="field">
      <label for="review-type">Review Type</label>
      <select
        id="review-type"
        :value="selectedReviewType"
        @change="handleReviewTypeChange"
        class="form-select"
        :disabled="!paperStore.file || loading"
      >
        <option value="">Select a review type...</option>
        <option
          v-for="[value, label] in REVIEW_TYPE_OPTIONS"
          :key="value"
          :value="value"
          :disabled="!isReviewTypeCompatible(value, paperType)"
        >
          {{ label }}
        </option>
      </select>
    </div>

    <!-- System Prompt Editor -->
    <div class="field" v-if="selectedReviewType">
      <label for="system-prompt">
        System Prompt
        <span v-if="isDirty" class="dirty-indicator">*</span>
      </label>
      <textarea
        id="system-prompt"
        v-model="promptStore.currentSystemPrompt"
        rows="10"
        class="prompt-textarea"
        placeholder="System prompt will load here..."
        :disabled="isLoadingPrompt || loading"
      ></textarea>
    </div>

    <!-- Message Part Editor -->
    <div class="field" v-if="selectedReviewType">
      <label for="message-part">
        Message Part
        <span v-if="isDirty" class="dirty-indicator">*</span>
      </label>
      <textarea
        id="message-part"
        v-model="promptStore.currentMessagePart"
        rows="10"
        class="prompt-textarea"
        placeholder="Message part will load here..."
        :disabled="isLoadingPrompt || loading"
      ></textarea>
    </div>

    <!-- Reload Prompts Warning -->
    <div
      v-if="(settingsChanged || combinedPromptError) && selectedReviewType"
      class="warning-message reload-warning"
    >
      <span v-if="settingsChanged">⚠️ Settings have changed. The prompts are outdated.</span>
      <span v-else>Prompt loading failed. Retry when ready.</span>
      <Button
        :label="
          combinedPromptError ? 'Retry Loading Prompts' : 'Reload Prompts for Changed Settings'
        "
        @click="reloadPrompts"
        :loading="isLoadingPrompt"
        :disabled="!isReviewTypeCompatible(selectedReviewType, paperType)"
        severity="warning"
        size="small"
      />
    </div>

    <!-- Actions -->
    <div class="actions" v-if="selectedReviewType">
      <Button
        label="Reset to Original"
        @click="resetPrompts"
        :disabled="!isDirty || isLoadingPrompt || loading"
        severity="secondary"
      />
      <Button
        :label="!paperStore.file ? 'Upload a file first' : 'Send Review Request'"
        @click="sendReview"
        :loading="loading || isLoadingPrompt"
        :disabled="
          !paperStore.file ||
          isLoadingPrompt ||
          loadedReviewType !== selectedReviewType ||
          settingsChanged ||
          !promptsAreValid ||
          !isReviewTypeCompatible(selectedReviewType, paperType)
        "
      />
    </div>

    <!-- Error Display -->
    <div v-if="error || combinedPromptError" class="error-message">
      {{ error || combinedPromptError }}
    </div>
  </div>

  <!-- Warning Modal -->
  <div v-if="showWarning" class="modal-overlay" @click="cancelWarning">
    <div class="modal-content" @click.stop>
      <h3>Unsaved Changes</h3>
      <p>You have unsaved changes to your prompts. Do you want to discard them?</p>
      <div class="modal-actions">
        <button class="modal-button secondary" @click="cancelWarning">Cancel</button>
        <button class="modal-button primary" @click="confirmWarning">Discard Changes</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import { usePaperStore } from '../stores/paperStore'
import { usePromptStore } from '../stores/promptStore'
import { REVIEW_TYPE_OPTIONS, isReviewTypeCompatible, type ReviewType } from '../constants'

const paperStore = usePaperStore()
const promptStore = usePromptStore()
const { file, wip, paperType, hasPageLimit, pageLimit, currentPages } = storeToRefs(paperStore)
const { isDirty, combinedPromptError, isLoadingPrompt, loadedReviewType } = storeToRefs(promptStore)

const selectedReviewType = ref<ReviewType | ''>('')
const loading = ref(false)
const error = ref('')
const showWarning = ref(false)
const pendingReviewType = ref<ReviewType | ''>('')
const previousReviewType = ref<ReviewType | ''>('')

// Track settings state to detect changes
const settingsSnapshot = ref<{
  wip: boolean
  paperType: string
  hasPageLimit: boolean
  pageLimit: number
  currentPages: number
} | null>(null)
const settingsChanged = ref(false)
const promptsAreValid = computed(
  () =>
    promptStore.currentSystemPrompt.trim().length > 0 &&
    promptStore.currentMessagePart.trim().length > 0,
)

// Handle review type change with dirty check
async function loadSelectedPrompts(type: ReviewType) {
  error.value = ''
  const loaded = await loadPromptsForType(type)
  if (loaded && selectedReviewType.value === type) {
    takeSettingsSnapshot()
  }
}

function handleReviewTypeChange(event: Event) {
  const select = event.target as HTMLSelectElement
  const newType = select.value as ReviewType | ''

  // If no previous type was selected or no unsaved changes, load directly
  if (!previousReviewType.value || !isDirty.value) {
    selectedReviewType.value = newType
    previousReviewType.value = newType
    pendingReviewType.value = ''
    if (newType) {
      void loadSelectedPrompts(newType)
    } else {
      promptStore.cancelPromptLoad()
    }
    return
  }

  // Unsaved changes: show warning and revert dropdown to previous selection
  pendingReviewType.value = newType
  select.value = previousReviewType.value
  showWarning.value = true
}

function confirmWarning() {
  const newType = pendingReviewType.value
  showWarning.value = false
  selectedReviewType.value = newType
  previousReviewType.value = newType
  pendingReviewType.value = ''
  if (newType) {
    void loadSelectedPrompts(newType)
  } else {
    promptStore.cancelPromptLoad()
  }
}

function cancelWarning() {
  showWarning.value = false
  pendingReviewType.value = ''
}

// Import loadPromptsForType from store
const { loadPromptsForType } = promptStore

// Take a snapshot of current settings
function takeSettingsSnapshot() {
  settingsSnapshot.value = {
    wip: wip.value,
    paperType: paperType.value,
    hasPageLimit: hasPageLimit.value,
    pageLimit: pageLimit.value,
    currentPages: currentPages.value,
  }
  settingsChanged.value = false
}

// Check if settings have changed since snapshot
function checkSettingsChanged() {
  if (!settingsSnapshot.value) {
    return false
  }
  return (
    settingsSnapshot.value.wip !== wip.value ||
    settingsSnapshot.value.paperType !== paperType.value ||
    settingsSnapshot.value.hasPageLimit !== hasPageLimit.value ||
    settingsSnapshot.value.pageLimit !== pageLimit.value ||
    settingsSnapshot.value.currentPages !== currentPages.value
  )
}

function resetPrompts() {
  promptStore.resetToOriginal()
}

async function reloadPrompts() {
  if (selectedReviewType.value) {
    await loadSelectedPrompts(selectedReviewType.value)
  }
}

async function sendReview() {
  if (!file.value || !selectedReviewType.value) {
    error.value = 'Please select a file and review type'
    return
  }

  if (
    loadedReviewType.value !== selectedReviewType.value ||
    isLoadingPrompt.value ||
    settingsChanged.value ||
    !promptsAreValid.value ||
    !isReviewTypeCompatible(selectedReviewType.value, paperType.value)
  ) {
    error.value = 'Load current, compatible, non-empty prompts before sending.'
    return
  }

  const reviewType = selectedReviewType.value
  const reviewedFile = file.value
  const systemPrompt = promptStore.currentSystemPrompt
  const messagePart = promptStore.currentMessagePart
  const useCustomPrompts = isDirty.value

  loading.value = true
  error.value = ''

  try {
    const result = await paperStore.sendReviewRequest(
      reviewType,
      useCustomPrompts ? systemPrompt : undefined,
      useCustomPrompts ? messagePart : undefined,
    )

    // Add review to store
    await paperStore.addReview(reviewType, systemPrompt, messagePart, result, reviewedFile)

    promptStore.resetToOriginal()
  } catch (err) {
    error.value = `Failed to send review: ${err}`
  } finally {
    loading.value = false
  }
}

// Watch for settings changes
watch([wip, paperType, hasPageLimit, pageLimit, currentPages], () => {
  if (settingsSnapshot.value) {
    settingsChanged.value = checkSettingsChanged()
  }
})
</script>

<style scoped>
.review-editor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  font-size: 0.95rem;
}

.dirty-indicator {
  color: #f59e0b;
  font-weight: bold;
}

.form-select {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1.5px solid #bfdbfe;
  border-radius: 8px;
  background: linear-gradient(90deg, #f0f9ff 0%, #eff6ff 100%);
  cursor: pointer;
  color: #1e40af;
  transition: all 0.2s;
  font-weight: 500;
}

.form-select:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: linear-gradient(90deg, #dbeafe 0%, #e0f2fe 100%);
}

.form-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.prompt-textarea {
  width: 100%;
  padding: 0.75rem;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  border: 1.5px solid #d8b4fe;
  border-radius: 8px;
  resize: vertical;
  min-height: 200px;
  background: linear-gradient(90deg, #faf5ff 0%, #f5f3ff 100%);
  color: #7c3aed;
  transition: all 0.2s;
  box-shadow: 0 1px 4px 0 rgba(124, 58, 237, 0.08);
}

.prompt-textarea:focus {
  outline: none;
  border-color: #c084fc;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
  background: linear-gradient(90deg, #ede9fe 0%, #e9d5ff 100%);
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.error-message {
  padding: 1rem;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #991b1b;
  font-weight: 500;
}

.warning-message {
  padding: 1rem;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 4px;
  color: #92400e;
  font-weight: 500;
  text-align: center;
}

.reload-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
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
</style>
