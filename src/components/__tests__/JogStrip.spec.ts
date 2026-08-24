import JogStrip from '@/components/JogStrip.vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const render = (over: Record<string, unknown> = {}) =>
  mount(JogStrip, { props: { modelValue: 0, step: 0.01, min: -12, max: 12, label: '0.00', ...over } })

const latest = (wrapper: ReturnType<typeof render>) => (wrapper.emitted('update:modelValue')!.at(-1) as number[])[0]

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
})

describe('JogStrip dragging', () => {
  const drag = async (wrapper: ReturnType<typeof render>, dx: number) => {
    await wrapper.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    await wrapper.trigger('pointermove', { clientX: 100 + dx, pointerId: 1 })
  }

  it('moves the value one step every few pixels', async () => {
    const wrapper = render()
    await drag(wrapper, 40) // 40px at 4px per step = 10 steps of 0.01
    expect(latest(wrapper)).toBeCloseTo(0.1, 6)
  })

  it('goes down when dragged left', async () => {
    const wrapper = render()
    await drag(wrapper, -20)
    expect(latest(wrapper)).toBeCloseTo(-0.05, 6)
  })

  it('lands on exact multiples of the step', async () => {
    const wrapper = render()
    await drag(wrapper, 7) // 1.75 steps
    expect(latest(wrapper)).toBeCloseTo(0.02, 6)
  })

  it('clamps to the range', async () => {
    const wrapper = render({ min: -1, max: 1 })
    await drag(wrapper, 10000)
    expect(latest(wrapper)).toBe(1)
  })

  it('keeps dragging relative to where the press started, not the last move', async () => {
    const wrapper = render()
    await wrapper.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    await wrapper.trigger('pointermove', { clientX: 140, pointerId: 1 })
    await wrapper.trigger('pointermove', { clientX: 120, pointerId: 1 })
    expect(latest(wrapper)).toBeCloseTo(0.05, 6)
  })

  it('does nothing once the press is released', async () => {
    const wrapper = render()
    await drag(wrapper, 40)
    await wrapper.trigger('pointerup', { pointerId: 1 })
    const before = wrapper.emitted('update:modelValue')!.length
    await wrapper.trigger('pointermove', { clientX: 400, pointerId: 1 })
    expect(wrapper.emitted('update:modelValue')).toHaveLength(before)
  })

  it('supports whole-bpm steps for tempo', async () => {
    const wrapper = render({ modelValue: 120, step: 1, min: 60, max: 180 })
    await drag(wrapper, 12) // 3 steps of 1 bpm
    expect(latest(wrapper)).toBe(123)
  })
})

describe('JogStrip wheel', () => {
  it('steps up and down from the running value', async () => {
    const wrapper = render({ modelValue: 0.5 })
    await wrapper.trigger('wheel', { deltaY: -1 })
    expect(latest(wrapper)).toBeCloseTo(0.51, 6)
    await wrapper.trigger('wheel', { deltaY: 1 })
    expect(latest(wrapper)).toBeCloseTo(0.5, 6)
  })
})

describe('JogStrip display', () => {
  it('shows the label and optional sub-label', () => {
    expect(render({ label: '1.05x', sub: '126 bpm' }).text()).toContain('1.05x')
    expect(render({ label: '1.05x', sub: '126 bpm' }).text()).toContain('126 bpm')
  })
})
