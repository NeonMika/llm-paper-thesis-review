import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../App.vue'

vi.mock('../api', () => ({
  default: {
    sections_system_prompt: { get: vi.fn().mockResolvedValue({ data: '', error: null }) },
  },
}))

// Slot-preserving Card stub so title/content remain visible in wrapper.text()
const CardStub = defineComponent({
  render() {
    const slots = this.$slots
    return h('div', [
      slots.title ? slots.title() : null,
      slots.header ? slots.header() : null,
      slots.content ? slots.content() : null,
      slots.default ? slots.default() : null,
    ])
  },
})

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('renders the application title', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          ReviewPromptEditor: true,
          ReviewResultsList: true,
          Card: CardStub,
          Button: true,
          ProgressSpinner: true,
        },
      },
    })
    expect(wrapper.text()).toContain('Paper & Thesis Review Tool')
  })

  it('renders the Google Gemini Settings card', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          ReviewPromptEditor: true,
          ReviewResultsList: true,
          Card: CardStub,
          Button: true,
          ProgressSpinner: true,
        },
      },
    })
    expect(wrapper.text()).toContain('Google Gemini Settings')
  })
})
