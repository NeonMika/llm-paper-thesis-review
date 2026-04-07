import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../App.vue'

vi.mock('../api', () => ({
  default: {
    sections_system_prompt: { get: vi.fn().mockResolvedValue({ data: '', error: null }) },
    overall_analysis_system_prompt: { post: vi.fn().mockResolvedValue({ data: '', error: null }) },
    overall_general_analysis_message_part: { post: vi.fn().mockResolvedValue({ data: '', error: null }) },
    overall_detailed_analysis_message_part: { post: vi.fn().mockResolvedValue({ data: '', error: null }) },
    review_system_prompt: { post: vi.fn().mockResolvedValue({ data: '', error: null }) },
    review_message_part: { post: vi.fn().mockResolvedValue({ data: '', error: null }) },
    ase_system_prompt: { post: vi.fn().mockResolvedValue({ data: '', error: null }) },
    ase_message_part: { post: vi.fn().mockResolvedValue({ data: '', error: null }) },
  },
}))

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the application title', () => {
    const wrapper = mount(App, {
      global: {
        stubs: { ReviewPromptEditor: true, ReviewResultsList: true },
      },
    })
    expect(wrapper.text()).toContain('Paper & Thesis Review Tool')
  })

  it('renders the Google Gemini Settings card', () => {
    const wrapper = mount(App, {
      global: {
        stubs: { ReviewPromptEditor: true, ReviewResultsList: true },
      },
    })
    expect(wrapper.text()).toContain('Google Gemini Settings')
  })
})
