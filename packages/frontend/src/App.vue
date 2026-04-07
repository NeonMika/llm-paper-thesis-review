<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { usePaperStore } from './stores/paperStore.ts'
import { usePromptStore } from './stores/promptStore'
import { marked } from 'marked'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import ReviewPromptEditor from './components/ReviewPromptEditor.vue'
import ReviewResultsList from './components/ReviewResultsList.vue'

const paperStore = usePaperStore()
const promptStore = usePromptStore()
const fileInput = ref<HTMLInputElement | null>(null)

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    paperStore.readPaperFromFile(input.files[0])
  }
}

function clearFile() {
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  paperStore.file = null
}

const modelOptions = [
  { label: 'Gemini 3 Pro Preview', value: 'pro' },
  { label: 'Gemini 3 Flash Preview', value: 'flash' },
]

// Initialize sections system prompt
promptStore.fetchSectionsSystemPrompt()

// Warn before leaving page if there are unsaved changes
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (promptStore.isDirty) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// Helper function to detect validation hint messages vs true errors
function isValidationHint(error: unknown): boolean {
  if (!error) return false
  const errorString = typeof error === 'string' ? error : JSON.stringify(error)
  return errorString.includes('müssen gesetzt sein') || errorString.includes('must be set')
}
</script>

<template>
  <div class="p-grid p-justify-center">
    <div class="p-col-12 p-md-8">

      <h1>Paper & Thesis Review Tool</h1>

      <!-- Google Gemini Settings Card -->
      <Card class="card">
        <template #title>
          <h2>Google Gemini Settings</h2>
        </template>
        <template #content>
          <div class="form-group">
            <label for="apiKey">API Key</label>
            <input id="apiKey" type="text" v-model="paperStore.apiKey" placeholder="Optional: Own Google API Key" class="p-mb-3" style="width: 100%"
              autocomplete="off" />
          </div>
          <p v-if="!paperStore.apiKey">
            <em>API key provided by Markus will be used if no API key is provided. If rate limits
              hit, provide your own key.</em>
          </p>
          <div class="form-group">
            <label for="modelSelect">Modell</label>
            <select id="modelSelect" v-model="paperStore.model" class="form-select">
              <option value="" disabled>Modell wählen</option>
              <option v-for="option in modelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </template>
      </Card>

      <Card class="card">
        <template #title>
          <h2>Settings</h2>
        </template>
        <template #content>
          <p>
            Upload a paper to analyze it for quality, get improvement suggestions and spell
            checking.
          </p>

          <form>
            <!-- File Upload Area -->
            <label for="paper" class="file-upload-container">
              <input ref="fileInput" type="file" id="paper" name="paper" @change="handleFileChange" :disabled="paperStore.loading" class="file-input-hidden" />
              <div class="file-upload-area">
                <div class="upload-icon">📤</div>
                <div class="upload-text">
                  <strong>Click to select or drag-and-drop your paper</strong>
                  <span class="upload-hint">(PDF, DOCX, TXT, or other formats)</span>
                </div>
              </div>
              <div v-if="paperStore.file" class="file-display">
                <span class="file-name">📄 {{ paperStore.file.name }}</span>
                <button type="button" @click.stop="clearFile" class="clear-button" title="Clear file">✕</button>
              </div>
            </label>

            <div class="form-group">
              <label for="paperType">Paper Type: </label>
              <select id="paperType" v-model="paperStore.paperType" class="form-select">
                <option v-for="type in paperStore.paperTypes" :key="type.optionValue" :value="type.optionValue">
                  {{ type.optionLabel }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <input type="checkbox" id="wip" v-model="paperStore.wip" />
              <label for="wip">Work in Progress</label>
            </div>

            <div class="form-group">
              <input type="checkbox" id="hasPageLimit" v-model="paperStore.hasPageLimit" />
              <label for="hasPageLimit">Has Page Limit</label>
            </div>

            <div v-if="paperStore.hasPageLimit" class="form-group">
              <label for="pageLimit">Page Limit (# of pages)</label>
              <input type="number" id="pageLimit" v-model.number="paperStore.pageLimit" step="0.5" min="0" />
            </div>

            <div v-if="paperStore.hasPageLimit" class="form-group">
              <label for="currentPages">Current # of pages</label>
              <input type="number" id="currentPages" v-model.number="paperStore.currentPages" step="0.5" min="0" />
            </div>
          </form>

          <!-- Error displays -->
          <div v-if="paperStore.sectionsError" class="p-error">
            <h2>Sections Error</h2>
            <pre>{{ JSON.stringify(paperStore.sectionsError, null, 2) }}</pre>
          </div>
          <div v-if="paperStore.sectionAnalysisError" class="p-error">
            <h2>Section Analysis Error</h2>
            <pre>{{ JSON.stringify(paperStore.sectionAnalysisError, null, 2) }}</pre>
          </div>
          <div v-if="promptStore.sectionAnalysisSystemPromptError"
            :class="isValidationHint(promptStore.sectionAnalysisSystemPromptError) ? 'p-hint' : 'p-error'">
            <h2>Section Analysis System Prompt Error</h2>
            <pre>{{ JSON.stringify(promptStore.sectionAnalysisSystemPromptError, null, 2) }}</pre>
          </div>
          <div v-if="promptStore.sectionAnalysisMessagePartError" :class="isValidationHint(promptStore.sectionAnalysisMessagePartError) ? 'p-hint' : 'p-error'">
            <h2>Section Analysis Message Part Error</h2>
            <pre>{{ JSON.stringify(promptStore.sectionAnalysisMessagePartError, null, 2) }}</pre>
          </div>
          <div v-if="promptStore.sectionsSystemPromptError" :class="isValidationHint(promptStore.sectionsSystemPromptError) ? 'p-hint' : 'p-error'">
            <h2>Sections System Prompt Error</h2>
            <pre>{{ JSON.stringify(promptStore.sectionsSystemPromptError, null, 2) }}</pre>
          </div>


          <h3>Paper Text</h3>

          <div v-if="paperStore.loadingContent" class="p-d-flex p-jc-center p-ai-center" style="height: 150px">
            <ProgressSpinner />
          </div>
          <p v-else-if="!paperStore.content">Load a paper for analysis.</p>
          <pre v-else id="paper-content">{{ paperStore.content }}</pre>


        </template>
      </Card>

      <!-- Review Prompt Editor -->
      <ReviewPromptEditor />

      <!-- Review Results List -->
      <ReviewResultsList />

      <Card class="card">
        <template #title>
          <h2>Section Titles</h2>
        </template>
        <template #content>
          <div>
            <strong>System Prompt:</strong><br />
            <pre v-if="promptStore.sectionsSystemPrompt" class="prompt-pre">{{ promptStore.sectionsSystemPrompt }}</pre>
            <strong>Result:</strong><br />
            <div v-if="paperStore.loadingSections" class="p-d-flex p-jc-center p-ai-center" style="height: 150px">
              <ProgressSpinner />
            </div>
            <p v-else-if="paperStore.sections.length === 0">
              Please send a paper to extract section titles.
            </p>
            <ul v-else>
              <li v-for="(section, index) in paperStore.sections" :key="index">
                <span v-if="section.sectionNumber">{{ section.sectionNumber }}. </span>{{ section.title }}
                <Card class="card p-mb-2 p-mt-2">
                  <template #content>
                    <div>
                      <strong>System Prompt:</strong><br />
                      <pre v-if="promptStore.sectionAnalysisSystemPrompt[section.title]"
                        class="prompt-pre">{{ promptStore.sectionAnalysisSystemPrompt[section.title] }}</pre>
                      <strong>Message Part:</strong><br />
                      <pre v-if="promptStore.sectionAnalysisMessagePart[section.title]"
                        class="prompt-pre">{{ promptStore.sectionAnalysisMessagePart[section.title] }}</pre>
                      <strong>Result:</strong><br />
                      <div v-if="paperStore.isLoadingSectionAnalysis(section.title)" class="p-d-flex p-jc-center p-ai-center" style="height: 150px">
                        <ProgressSpinner />
                      </div>
                      <div v-else class="result-div" v-html="section.analysis ? marked.parse(section.analysis) : ''"></div>
                      <Button @click="paperStore.enrichWithSectionAnalysis(section.title)"
                        :disabled="paperStore.loading || paperStore.isLoadingSectionAnalysis(section.title)"
                        :loading="paperStore.isLoadingSectionAnalysis(section.title)">Perform Section Analysis
                      </Button>
                    </div>
                  </template>
                </Card>
              </li>
            </ul>
          </div>
          <Button @click="paperStore.getSectionTitles" :disabled="paperStore.loading || !paperStore.content || !paperStore.paperType" class="p-mt-3">
            Extract Sections
          </Button>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.p-grid {
  margin: 0;
}

#paper-content {
  max-height: 50vh;
  max-width: 75vw;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 1em;
  color: #1f2937;
  font-size: 1.05em;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.1);
}

.card {
  box-shadow:
    0 4px 16px 0 rgba(0, 0, 0, 0.1),
    0 2px 8px 0 rgba(0, 0, 0, 0.06);
  padding: 1.5em 1.5em 1em 1.5em;
  margin: 2em 0;
  border-radius: 18px;
  border: 1.5px solid #e5e7eb;
  background: linear-gradient(120deg, #ffffff 0%, #f9fafb 100%);
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow:
    0 8px 32px 0 rgba(0, 0, 0, 0.15),
    0 4px 16px 0 rgba(0, 0, 0, 0.1);
  border-color: #60a5fa;
}

form>* {
  margin-top: 1em;
}

.p-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 0.75em 1em;
  margin-bottom: 1em;
  font-size: 1em;
}

.p-hint {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.75em 1em;
  margin-bottom: 1em;
  font-size: 1em;
}

.p-hint {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.75em 1em;
  margin-bottom: 1em;
  font-size: 1em;
}

.prompt-pre {
  max-width: 100%;
  max-height: 33vh;
  overflow-x: auto;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: linear-gradient(90deg, #faf5ff 0%, #f5f3ff 100%);
  border: 1.5px solid #d8b4fe;
  border-radius: 8px;
  padding: 0.75em 1em;
  margin-bottom: 0.75em;
  color: #7c3aed;
  font-size: 1.04em;
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  box-shadow: 0 1px 4px 0 rgba(124, 58, 237, 0.08);
}

.result-div {
  max-width: 100%;
  max-height: 50vh;
  overflow-x: auto;
  overflow-y: auto;
  background: linear-gradient(90deg, #f3f4f6 0%, #ffffff 100%);
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  padding: 0.85em 1.1em;
  margin-bottom: 0.85em;
  word-break: break-word;
  color: #1f2937;
  font-size: 1.08em;
  font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
  box-shadow: 0 1px 4px 0 rgba(56, 142, 60, 0.07);
}

h1,
h2 {
  color: #1565c0;
  letter-spacing: 0.02em;
  margin-bottom: 0.5em;
}

h2 {
  font-size: 1.35em;
  color: #00796b;
}

strong {
  color: #1976d2;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.p-mt-3 {
  margin-top: 1.5em !important;
}

.p-mb-3 {
  margin-bottom: 1.5em !important;
}

.p-mb-2 {
  margin-bottom: 1em !important;
}

.p-mt-2 {
  margin-top: 1em !important;
}

.form-group {
  margin-bottom: 1em;
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

input[type='checkbox'] {
  accent-color: #10b981;
  margin-right: 0.5em;
  cursor: pointer;
  width: 18px;
  height: 18px;
}

input[type='text'] {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1.5px solid #bfdbfe;
  border-radius: 8px;
  background: linear-gradient(90deg, #f0f9ff 0%, #eff6ff 100%);
  color: #1e40af;
  transition: all 0.2s;
  font-weight: 500;
}

input[type='text']::placeholder {
  color: #7dd3fc;
}

input[type='text']:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: linear-gradient(90deg, #dbeafe 0%, #e0f2fe 100%);
}

input[type='number'] {
  border: 1.5px solid #bfdbfe;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 1rem;
  background: linear-gradient(90deg, #f0f9ff 0%, #eff6ff 100%);
  color: #1e40af;
  margin-right: 0.5em;
  transition: all 0.2s;
  font-weight: 500;
}

input[type='number']:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: linear-gradient(90deg, #dbeafe 0%, #e0f2fe 100%);
}

label {
  color: #1f2937;
  font-size: 1em;
  margin-left: 0.2em;
}

.file-upload-container {
  margin-bottom: 1.5em;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
}

.file-input-hidden {
  display: none;
}

.file-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border: 2.5px dashed #bfdbfe;
  border-radius: 12px;
  padding: 2.5rem 1.5rem;
  background: linear-gradient(90deg, #f0f9ff 0%, #eff6ff 100%);
  color: #1e40af;
  transition: all 0.3s;
  min-height: 140px;
  text-align: center;
}

.file-upload-container:hover .file-upload-area:not(:has(input:disabled)) {
  border-color: #60a5fa;
  background: linear-gradient(90deg, #e0f2fe 0%, #dbeafe 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.12);
}

.file-upload-container:focus-within .file-upload-area {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: linear-gradient(90deg, #dbeafe 0%, #e0f2fe 100%);
}

.upload-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-weight: 600;
}

.upload-text strong {
  color: #1e40af;
  font-size: 1.05rem;
}

.upload-hint {
  font-size: 0.85rem;
  font-weight: 400;
  color: #60a5fa;
}

.file-input-hidden:disabled~.file-upload-area {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: linear-gradient(90deg, #f0f9ff 0%, #eff6ff 100%);
  border: 1.5px solid #bfdbfe;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.08);
}

.file-name {
  color: #1e40af;
  font-weight: 600;
  font-size: 0.95rem;
  word-break: break-word;
}

.clear-button {
  padding: 0.5rem 0.75rem;
  margin-left: 1rem;
  border: 1px solid #dc2626;
  border-radius: 4px;
  background: #fee2e2;
  color: #991b1b;
  font-weight: 600;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.clear-button:hover {
  background: #fecaca;
  border-color: #b91c1c;
}

.clear-button:active {
  transform: scale(0.95);
}

ul {
  padding-left: 1.2em;
}

li {
  margin-bottom: 1.2em;
}

.p-button {
  background: linear-gradient(90deg, #4dd0e1 0%, #64b5f6 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.08em;
  padding: 0.6em 1.5em;
  box-shadow: 0 2px 8px 0 rgba(33, 150, 243, 0.08);
  transition:
    background 0.2s,
    box-shadow 0.2s;
}

.p-button:hover,
.p-button:focus {
  background: linear-gradient(90deg, #1976d2 0%, #26a69a 100%);
  color: #fff;
  box-shadow: 0 4px 16px 0 rgba(33, 150, 243, 0.13);
}

.p-listbox {
  border-radius: 8px;
  border: 1.5px solid #b2ebf2;
  background: #f4faff;
  color: #234;
  font-size: 1.05em;
}

.p-listbox .p-listbox-item.p-highlight {
  background: linear-gradient(90deg, #b2ebf2 0%, #b2dfdb 100%);
  color: #1565c0;
}

.p-listbox .p-listbox-item {
  border-radius: 6px;
  margin: 0.1em 0;
}

.p-fileupload {
  border-radius: 8px;
  border: 1.5px solid #b2ebf2;
  background: #e3fdfd;
  color: #234;
  font-size: 1.05em;
  margin-bottom: 1em;
}

.p-fileupload .p-button {
  background: linear-gradient(90deg, #4dd0e1 0%, #64b5f6 100%);
  color: #fff;
}

.p-fileupload .p-button:hover,
.p-fileupload .p-button:focus {
  background: linear-gradient(90deg, #1976d2 0%, #26a69a 100%);
  color: #fff;
}

.p-d-flex {
  display: flex;
}

.p-jc-center {
  justify-content: center;
}

.p-ai-center {
  align-items: center;
}
</style>
