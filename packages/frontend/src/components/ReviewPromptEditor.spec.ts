import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReviewPromptEditor from './ReviewPromptEditor.vue'
import { usePaperStore } from '../stores/paperStore'

const apiMocks = vi.hoisted(() => ({
  promptPost: vi.fn(),
  sectionsGet: vi.fn(),
}))

vi.mock('../api', () => ({
  default: {
    prompts: new Proxy(
      {},
      {
        get: (_target, reviewType: string) => ({
          post: (body: unknown) => apiMocks.promptPost(reviewType, body),
        }),
      },
    ),
    sections_system_prompt: {
      get: apiMocks.sectionsGet,
    },
  },
}))

const ButtonStub = defineComponent({
  props: {
    label: { type: String, default: '' },
    disabled: Boolean,
    loading: Boolean,
  },
  emits: ['click'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          disabled: props.disabled || props.loading,
          onClick: () => emit('click'),
        },
        props.label,
      )
  },
})

function mountEditor() {
  const paperStore = usePaperStore()
  paperStore.file = new File(['paper'], 'paper.txt', { type: 'text/plain' })
  paperStore.paperType = 'full conference paper'

  return {
    paperStore,
    wrapper: mount(ReviewPromptEditor, {
      global: {
        stubs: {
          Button: ButtonStub,
        },
      },
    }),
  }
}

function buttonWithText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

describe('ReviewPromptEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    apiMocks.promptPost.mockReset()
    apiMocks.sectionsGet.mockReset()
    apiMocks.sectionsGet.mockResolvedValue({ data: 'sections prompt', error: null })
    apiMocks.promptPost.mockImplementation(async (reviewType: string) => ({
      data: {
        systemPrompt: `${reviewType} system`,
        messagePart: `${reviewType} message`,
      },
      error: null,
    }))
  })

  it('requires confirmation before replacing edited prompts with another review type', async () => {
    const { wrapper } = mountEditor()
    const select = wrapper.get('select')

    await select.setValue('analysis')
    await flushPromises()
    await wrapper.findAll('textarea')[0].setValue('edited system')

    await select.setValue('review')
    await nextTick()

    expect((select.element as HTMLSelectElement).value).toBe('analysis')
    expect(wrapper.text()).toContain('Unsaved Changes')
    expect(apiMocks.promptPost.mock.calls.map(([reviewType]) => reviewType)).toEqual(['analysis'])

    await buttonWithText(wrapper, 'Discard Changes').trigger('click')
    await flushPromises()

    expect((select.element as HTMLSelectElement).value).toBe('review')
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    expect(apiMocks.promptPost.mock.calls.map(([reviewType]) => reviewType)).toEqual([
      'analysis',
      'review',
    ])
  })

  it('blocks sending until prompts are reloaded after settings change', async () => {
    const { paperStore, wrapper } = mountEditor()

    await wrapper.get('select').setValue('analysis')
    await flushPromises()
    expect(buttonWithText(wrapper, 'Send Review Request').attributes('disabled')).toBeUndefined()

    paperStore.wip = true
    await nextTick()

    expect(wrapper.text()).toContain('Settings have changed. The prompts are outdated.')
    expect(buttonWithText(wrapper, 'Send Review Request').attributes('disabled')).toBeDefined()

    await buttonWithText(wrapper, 'Reload Prompts for Changed Settings').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Settings have changed. The prompts are outdated.')
    expect(buttonWithText(wrapper, 'Send Review Request').attributes('disabled')).toBeUndefined()
  })
})
