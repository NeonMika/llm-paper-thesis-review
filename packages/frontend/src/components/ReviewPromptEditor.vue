<template>
  <Card>
    <template #title>LLM Review Editor</template>
    <template #content>
      <div class="review-editor">
        <!-- File Status Warning -->
        <div v-if="!paperStore.file" class="warning-message">
          ⚠️ Please upload a paper file in the Settings section above before using the review editor.
        </div>

        <!-- Review Type Selector -->
        <div class="field">
          <label for="review-type">Review Type</label>
          <select id="review-type" v-model="selectedReviewType" @change="handleReviewTypeChange" class="form-select" :disabled="!paperStore.file">
            <option value="">Select a review type...</option>
            <option v-for="[value, label] in Object.entries(REVIEW_TYPE_LABELS)" :key="value" :value="value">
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
          <textarea id="system-prompt" v-model="promptStore.currentSystemPrompt" rows="10" class="prompt-textarea"
            placeholder="System prompt will load here..."></textarea>
        </div>

        <!-- Message Part Editor -->
        <div class="field" v-if="selectedReviewType">
          <label for="message-part">
            Message Part
            <span v-if="isDirty" class="dirty-indicator">*</span>
          </label>
          <textarea id="message-part" v-model="promptStore.currentMessagePart" rows="10" class="prompt-textarea"
            placeholder="Message part will load here..."></textarea>
        </div>

        <!-- Reload Prompts Warning -->
        <div v-if="settingsChanged && selectedReviewType" class="warning-message reload-warning">
          ⚠️ Settings have changed. The prompts may be outdated.
          <Button label="Reload Prompts for Changed Settings" @click="reloadPrompts" severity="warning" size="small" />
        </div>

        <!-- Actions -->
        <div class="actions" v-if="selectedReviewType">
          <Button label="Reset to Original" @click="resetPrompts" :disabled="!isDirty" severity="secondary" />
          <Button :label="!paperStore.file ? 'Upload a file first' : 'Send Review Request'" @click="sendReview" :loading="loading"
            :disabled="!paperStore.file" />
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </template>
  </Card>

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
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { usePaperStore } from '../stores/paperStore'
import { usePromptStore } from '../stores/promptStore'
import { REVIEW_TYPE_LABELS } from '../constants'

const paperStore = usePaperStore()
const promptStore = usePromptStore()
const { file, wip, paperType, hasPageLimit, pageLimit, currentPages } = storeToRefs(paperStore)
const { isDirty } = storeToRefs(promptStore)

const selectedReviewType = ref('')
const loading = ref(false)
const error = ref('')
const showWarning = ref(false)
const pendingReviewType = ref('')
const previousReviewType = ref('')

// Track settings state to detect changes
const settingsSnapshot = ref<{
  wip: boolean
  paperType: string
  hasPageLimit: boolean
  pageLimit: number
  currentPages: number
} | null>(null)
const settingsChanged = ref(false)

// Handle review type change with dirty check
function handleReviewTypeChange() {
  const newType = selectedReviewType.value

  // If no previous type was selected or no unsaved changes, load directly
  if (!previousReviewType.value || !isDirty.value) {
    previousReviewType.value = newType
    pendingReviewType.value = newType
    loadPromptsForType(newType)
    takeSettingsSnapshot()
    return
  }

  // Unsaved changes: show warning and revert dropdown to previous selection
  pendingReviewType.value = newType
  selectedReviewType.value = previousReviewType.value  // revert dropdown immediately
  showWarning.value = true
}

function confirmWarning() {
  showWarning.value = false
  selectedReviewType.value = pendingReviewType.value
  previousReviewType.value = pendingReviewType.value
  loadPromptsForType(pendingReviewType.value)
  takeSettingsSnapshot()
  pendingReviewType.value = ''
}

function cancelWarning() {
  showWarning.value = false
  // selectedReviewType was already reverted in handleReviewTypeChange
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
    currentPages: currentPages.value
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

function reloadPrompts() {
  if (selectedReviewType.value) {
    loadPromptsForType(selectedReviewType.value)
    takeSettingsSnapshot()
  }
}

async function sendReview() {
  if (!file.value || !selectedReviewType.value) {
    error.value = 'Please select a file and review type'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const result = await paperStore.sendReviewRequest(
      selectedReviewType.value as 'analysis' | 'analysis-detailed' | 'review' | 'ase-review',
      promptStore.currentSystemPrompt,
      promptStore.currentMessagePart
    )

    // Add review to store
    await paperStore.addReview(
      selectedReviewType.value,
      promptStore.currentSystemPrompt,
      promptStore.currentMessagePart,
      result
    )

    // Reset dirty state by reloading original prompts
    await loadPromptsForType(selectedReviewType.value)
    takeSettingsSnapshot()

  } catch (err) {
    error.value = `Failed to send review: ${err}`
  } finally {
    loading.value = false
  }
}

// Watch for file changes and reload prompts if a type is selected
watch(file, () => {
  if (selectedReviewType.value) {
    loadPromptsForType(selectedReviewType.value)
    takeSettingsSnapshot()
  }
})

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
