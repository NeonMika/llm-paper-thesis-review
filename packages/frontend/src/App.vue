<script setup lang="ts">
import { usePaperStore } from './stores/paperStore.ts'
import { usePromptStore } from './stores/promptStore'
import { marked } from 'marked'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'

const paperStore = usePaperStore()
const promptStore = usePromptStore()

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    paperStore.readPaperFromFile(input.files[0])
  }
}

const modelOptions = [
  { label: 'Gemini 2.5 Pro', value: 'pro' },
  { label: 'Gemini 2.5 Flash', value: 'flash' },
]

// Prompts initial laden
promptStore.fetchSectionsSystemPrompt()
promptStore.fetchReviewSystemPrompt()
promptStore.fetchReviewMessagePart()
</script>

<template>
  <div class="p-grid p-justify-center">
    <div class="p-col-12 p-md-8">
      <!-- Google Gemini Settings Card -->
      <Card class="card">
        <template #title>
          <h2>Google Gemini Settings</h2>
        </template>
        <template #content>
          <div class="form-group">
            <label for="apiKey">API Key</label>
            <input
              id="apiKey"
              type="text"
              v-model="paperStore.apiKey"
              placeholder="Optional: Own Google API Key"
              class="p-mb-3"
              style="width: 100%"
              autocomplete="off"
            />
          </div>
          <p v-if="!paperStore.apiKey">
            <em
              >API key provided by Markus will be used if no API key is provided. If rate limits
              hit, provide your own key.</em
            >
          </p>
          <div class="form-group">
            <label for="modelSelect">Modell</label>
            <select id="modelSelect" v-model="paperStore.model" class="p-mb-3" style="width: 100%">
              <option value="" disabled>Modell wählen</option>
              <option v-for="option in modelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </template>
      </Card>

      <!-- Fehleranzeigen für alle Fehler aus paperStore und promptStore -->
      <div v-if="paperStore.sectionsError" class="p-error">
        <h2>Sections Error</h2>
        <pre>{{ JSON.stringify(paperStore.sectionsError, null, 2) }}</pre>
      </div>
      <div v-if="paperStore.overallAnalysisError" class="p-error">
        <h2>Overall Analysis Error</h2>
        <pre>{{ JSON.stringify(paperStore.overallAnalysisError, null, 2) }}</pre>
      </div>
      <div v-if="paperStore.reviewError" class="p-error">
        <h2>Review Error</h2>
        <pre>{{ JSON.stringify(paperStore.reviewError, null, 2) }}</pre>
      </div>
      <div v-if="paperStore.sectionAnalysisError" class="p-error">
        <h2>Section Analysis Error</h2>
        <pre>{{ JSON.stringify(paperStore.sectionAnalysisError, null, 2) }}</pre>
      </div>

      <div v-if="promptStore.overallAnalysisSystemPromptError" class="p-error">
        <h2>Overall Analysis System Prompt Error</h2>
        <pre>{{ JSON.stringify(promptStore.overallAnalysisSystemPromptError, null, 2) }}</pre>
      </div>
      <div v-if="promptStore.overallGeneralAnalysisMessagePartError" class="p-error">
        <h2>Overall General Analysis Message Part Error</h2>
        <pre>{{ JSON.stringify(promptStore.overallGeneralAnalysisMessagePartError, null, 2) }}</pre>
      </div>
      <div v-if="promptStore.overallDetailedAnalysisMessagePartError" class="p-error">
        <h2>Overall Detailed Analysis Message Part Error</h2>
        <pre>{{
          JSON.stringify(promptStore.overallDetailedAnalysisMessagePartError, null, 2)
        }}</pre>
      </div>
      <div v-if="promptStore.reviewSystemPromptError" class="p-error">
        <h2>Review System Prompt Error</h2>
        <pre>{{ JSON.stringify(promptStore.reviewSystemPromptError, null, 2) }}</pre>
      </div>
      <div v-if="promptStore.reviewMessagePartError" class="p-error">
        <h2>Review Message Part Error</h2>
        <pre>{{ JSON.stringify(promptStore.reviewMessagePartError, null, 2) }}</pre>
      </div>
      <div v-if="promptStore.sectionAnalysisSystemPromptError" class="p-error">
        <h2>Section Analysis System Prompt Error</h2>
        <pre>{{ JSON.stringify(promptStore.sectionAnalysisSystemPromptError, null, 2) }}</pre>
      </div>
      <div v-if="promptStore.sectionAnalysisMessagePartError" class="p-error">
        <h2>Section Analysis Message Part Error</h2>
        <pre>{{ JSON.stringify(promptStore.sectionAnalysisMessagePartError, null, 2) }}</pre>
      </div>
      <div v-if="promptStore.sectionsSystemPromptError" class="p-error">
        <h2>Sections System Prompt Error</h2>
        <pre>{{ JSON.stringify(promptStore.sectionsSystemPromptError, null, 2) }}</pre>
      </div>

      <Card class="card">
        <template #title>
          <h1>Paper Analyzer</h1>
        </template>
        <template #content>
          <p>
            Upload a paper to analyze it for quality, get improvement suggestions and spell
            checking.
          </p>

          <form>
            <input
              type="file"
              name="paper"
              @change="handleFileChange"
              :disabled="paperStore.loading"
              class="p-mb-3"
            />

            <div class="form-group">
              <label for="paperType">Paper Type: </label>
              <select id="paperType" v-model="paperStore.paperType" class="p-mb-3">
                <option
                  v-for="type in paperStore.paperTypes"
                  :key="type.optionValue"
                  :value="type.optionValue"
                >
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
              <input
                type="number"
                id="pageLimit"
                v-model.number="paperStore.pageLimit"
                step="0.5"
                min="0"
              />
            </div>

            <div v-if="paperStore.hasPageLimit" class="form-group">
              <label for="currentPages">Current # of pages</label>
              <input
                type="number"
                id="currentPages"
                v-model.number="paperStore.currentPages"
                step="0.5"
                min="0"
              />
            </div>
          </form>
        </template>
      </Card>

      <Card class="card">
        <template #title>
          <h2>Paper Text</h2>
        </template>
        <template #content>
          <div
            v-if="paperStore.loadingContent"
            class="p-d-flex p-jc-center p-ai-center"
            style="height: 150px"
          >
            <ProgressSpinner />
          </div>
          <p v-else-if="!paperStore.content">Load a paper for analysis.</p>
          <pre v-else id="paper-content">
            {{ paperStore.content }}
          </pre>
        </template>
      </Card>

      <Card class="card">
        <template #title>
          <h2>Paper Analysis</h2>
        </template>
        <template #content>
          <div>
            <strong>System Prompt:</strong><br />
            <pre v-if="promptStore.overallAnalysisSystemPrompt" class="prompt-pre">{{
              promptStore.overallAnalysisSystemPrompt
            }}</pre>
            <strong>Message Part (General Analysis):</strong><br />
            <pre v-if="promptStore.overallGeneralAnalysisMessagePart" class="prompt-pre">{{
              promptStore.overallGeneralAnalysisMessagePart
            }}</pre>
            <strong>Message Part (Detailed Analysis):</strong><br />
            <pre v-if="promptStore.overallDetailedAnalysisMessagePart" class="prompt-pre">{{
              promptStore.overallDetailedAnalysisMessagePart
            }}</pre>
            <strong>Result:</strong><br />
            <div
              v-if="paperStore.loadingOverallAnalysis"
              class="p-d-flex p-jc-center p-ai-center"
              style="height: 150px"
            >
              <ProgressSpinner />
            </div>
            <p v-else-if="!paperStore.overallAnalysis">Please send a paper for overall analysis.</p>
            <div
              v-if="paperStore.overallAnalysis"
              class="result-div"
              v-html="marked.parse(paperStore.overallAnalysis)"
            ></div>
            <pre class="result-div" v-if="paperStore.overallAnalysis">
              {{ paperStore.overallAnalysis }}
            </pre>
          </div>
          <Button
            @click="paperStore.getOverallAnalysisGeneral"
            :disabled="paperStore.loading || !paperStore.content || !paperStore.paperType"
            class="p-mt-3"
          >
            Perform General Overall Analysis
          </Button>
          &nbsp;
          <Button
            @click="paperStore.getOverallAnalysisDetailed"
            :disabled="paperStore.loading || !paperStore.content || !paperStore.paperType"
            class="p-mt-3"
          >
            Perform Detailed Overall Analysis
          </Button>
        </template>
      </Card>

      <Card class="card">
        <template #title>
          <h2>Paper Review</h2>
        </template>
        <template #content>
          <div>
            <strong>System Prompt:</strong><br />
            <pre v-if="promptStore.reviewSystemPrompt" class="prompt-pre">{{
              promptStore.reviewSystemPrompt
            }}</pre>
            <strong>Message Part:</strong><br />
            <pre v-if="promptStore.reviewMessagePart" class="prompt-pre">{{
              promptStore.reviewMessagePart
            }}</pre>
            <strong>Result:</strong><br />
            <div
              v-if="paperStore.loadingReview"
              class="p-d-flex p-jc-center p-ai-center"
              style="height: 150px"
            >
              <ProgressSpinner />
            </div>
            <p v-else-if="!paperStore.review">Please send a paper for review.</p>
            <div v-else class="result-div" v-html="marked.parse(paperStore.review)"></div>
            <pre class="result-div" v-if="paperStore.review">
              {{ paperStore.review }}
            </pre>
          </div>
          <Button
            @click="paperStore.getReview"
            :disabled="paperStore.loading || !paperStore.content || !paperStore.paperType"
            class="p-mt-3"
          >
            Perform Paper Review
          </Button>
        </template>
      </Card>

      <Card class="card">
        <template #title>
          <h2>Section Titles</h2>
        </template>
        <template #content>
          <div>
            <strong>System Prompt:</strong><br />
            <pre v-if="promptStore.sectionsSystemPrompt" class="prompt-pre">{{
              promptStore.sectionsSystemPrompt
            }}</pre>
            <strong>Result:</strong><br />
            <div
              v-if="paperStore.loadingSections"
              class="p-d-flex p-jc-center p-ai-center"
              style="height: 150px"
            >
              <ProgressSpinner />
            </div>
            <p v-else-if="paperStore.sections.length === 0">
              Please send a paper to extract section titles.
            </p>
            <ul v-else>
              <li v-for="(section, index) in paperStore.sections" :key="index">
                {{ section.sectionNumber ?? '#' }}. {{ section.title }}
                <Card class="card p-mb-2 p-mt-2">
                  <template #content>
                    <div>
                      <strong>System Prompt:</strong><br />
                      <pre
                        v-if="promptStore.sectionAnalysisSystemPrompt[section.title]"
                        class="prompt-pre"
                        >{{ promptStore.sectionAnalysisSystemPrompt[section.title] }}</pre
                      >
                      <strong>Message Part:</strong><br />
                      <pre
                        v-if="promptStore.sectionAnalysisMessagePart[section.title]"
                        class="prompt-pre"
                        >{{ promptStore.sectionAnalysisMessagePart[section.title] }}</pre
                      >
                      <strong>Result:</strong><br />
                      <div
                        v-if="paperStore.loadingSectionAnalysis"
                        class="p-d-flex p-jc-center p-ai-center"
                        style="height: 150px"
                      >
                        <ProgressSpinner />
                      </div>
                      <div
                        v-else
                        class="result-div"
                        v-html="section.analysis ? marked.parse(section.analysis) : ''"
                      ></div>
                      <pre class="result-div" v-if="section.analysis">
                        {{ section.analysis }}
                      </pre>
                      <Button
                        @click="paperStore.enrichWithSectionAnalysis(section.title)"
                        :disabled="paperStore.loading"
                        >Perform Section Analysis
                      </Button>
                    </div>
                  </template>
                </Card>
              </li>
            </ul>
          </div>
          <Button
            @click="paperStore.getSectionTitles"
            :disabled="paperStore.loading || !paperStore.content || !paperStore.paperType"
            class="p-mt-3"
          >
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

:global(body) {
  background: linear-gradient(135deg, #e0f7fa 0%, #e8f5e9 100%);
  min-height: 100vh;
  font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
}

#paper-content {
  max-height: 50vh;
  max-width: 75vw;
  overflow-y: auto;
  background: #f4faff;
  border-radius: 8px;
  border: 1px solid #b2ebf2;
  padding: 1em;
  color: #234;
  font-size: 1.05em;
  box-shadow: 0 2px 8px 0 rgba(60, 60, 60, 0.07);
}

.card {
  box-shadow:
    0 4px 16px 0 rgba(60, 120, 120, 0.13),
    0 2px 8px 0 rgba(60, 120, 120, 0.09);
  padding: 1.5em 1.5em 1em 1.5em;
  margin: 2em 0;
  border-radius: 18px;
  border: 1.5px solid #b2dfdb;
  background: linear-gradient(120deg, #e3fdfd 0%, #e8f5e9 100%);
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow:
    0 8px 32px 0 rgba(60, 120, 120, 0.18),
    0 4px 16px 0 rgba(60, 120, 120, 0.13);
  border-color: #4dd0e1;
}

form > * {
  margin-top: 1em;
}

.p-error {
  background: #ffebee;
  color: #b71c1c;
  border: 1px solid #ef9a9a;
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
  background: linear-gradient(90deg, #e3f2fd 0%, #e0f7fa 100%);
  border: 1.5px solid #90caf9;
  border-radius: 8px;
  padding: 0.75em 1em;
  margin-bottom: 0.75em;
  color: #1565c0;
  font-size: 1.04em;
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  box-shadow: 0 1px 4px 0 rgba(33, 150, 243, 0.07);
}

.result-div {
  max-width: 100%;
  max-height: 50vh;
  overflow-x: auto;
  overflow-y: auto;
  background: linear-gradient(90deg, #e8f5e9 0%, #e0f7fa 100%);
  border: 1.5px solid #81c784;
  border-radius: 8px;
  padding: 0.85em 1.1em;
  margin-bottom: 0.85em;
  word-break: break-word;
  color: #256029;
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

input[type='checkbox'] {
  accent-color: #26a69a;
  margin-right: 0.5em;
}

input[type='number'] {
  border: 1px solid #b2ebf2;
  border-radius: 6px;
  padding: 0.3em 0.7em;
  font-size: 1em;
  background: #f4faff;
  color: #234;
  margin-right: 0.5em;
}

label {
  color: #00796b;
  font-size: 1em;
  margin-left: 0.2em;
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
