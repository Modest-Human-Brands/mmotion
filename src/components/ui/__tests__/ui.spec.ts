import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'

import UiButton from '../UiButton.vue'
import UiSegmentedControl from '../UiSegmentedControl.vue'
import UiStepper from '../UiStepper.vue'
import UiTextField from '../UiTextField.vue'

describe('UiButton', () => {
  it('renders the slot and uses the primary fill by default', () => {
    const wrapper = mount(UiButton, { slots: { default: 'Continue' } })

    expect(wrapper.text()).toBe('Continue')
    expect(wrapper.classes()).toContain('bg-accent-500')
  })

  it('looks disabled and blocks clicks when disabled', async () => {
    const wrapper = mount(UiButton, { props: { disabled: true } })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('text-light-400')
  })
})

describe('UiTextField', () => {
  it('links the label to the input and updates the model', async () => {
    const wrapper = mount(UiTextField, {
      props: {
        label: 'Business name',
        modelValue: '',
        'onUpdate:modelValue': (value: string | undefined) =>
          wrapper.setProps({ modelValue: value }),
      },
    })

    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))

    await input.setValue('Red Cat')
    expect(wrapper.props('modelValue')).toBe('Red Cat')
  })

  it('renders a textarea when multiline and is read-only when asked', () => {
    const wrapper = mount(UiTextField, {
      props: { label: 'Message', multiline: true, readonly: true },
    })

    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
  })
})

describe('UiStepper', () => {
  it('marks done steps, the current step and upcoming steps', () => {
    const wrapper = mount(UiStepper, {
      props: { steps: ['Template', 'Brand', 'Details', 'Send'], current: 1, reachable: 2 },
    })
    const buttons = wrapper.findAll('li button')

    expect(buttons.map((node) => node.text())).toEqual([
      '✓ Template',
      '2 Brand',
      '3 Details',
      '4 Send',
    ])
    expect(wrapper.find('[aria-current="step"]').text()).toBe('2 Brand')
    // Approved steps can be reopened; later ones cannot.
    expect(buttons.map((node) => node.attributes('disabled') !== undefined)).toEqual([
      false,
      true,
      false,
      true,
    ])
  })

  it('opens a reachable step', async () => {
    const wrapper = mount(UiStepper, { props: { steps: ['A', 'B'], current: 1, reachable: 1 } })
    await wrapper.findAll('li button')[0]!.trigger('click')
    expect(wrapper.emitted('go')).toEqual([[0]])
  })
})

describe('UiSegmentedControl', () => {
  it('selects an option on click', async () => {
    const wrapper = mount(UiSegmentedControl, {
      props: {
        label: 'Pricing',
        modelValue: 'project',
        options: [
          { value: 'project', label: 'Per project' },
          { value: 'day', label: 'Per day' },
        ],
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })

    await wrapper.findAll('[role="radio"]')[1]?.trigger('click')

    expect(wrapper.props('modelValue')).toBe('day')
  })
})