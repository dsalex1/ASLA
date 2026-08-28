import AppUpdatePrompt from '@/components/AppUpdatePrompt.vue'
import * as update from '@/composables/useAppUpdate'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

describe('AppUpdatePrompt', () => {
  beforeEach(() => (update.updateReady.value = false))

  it('says nothing until a build is waiting', () => {
    mount(AppUpdatePrompt, { attachTo: document.body })
    expect(document.body.textContent).not.toContain('new version')
  })

  it('offers the update, and installs it when taken', async () => {
    const install = vi.spyOn(update, 'installUpdate').mockResolvedValue(undefined)
    mount(AppUpdatePrompt, { attachTo: document.body })

    update.updateReady.value = true
    await nextTick()
    expect(document.body.textContent).toContain('A new version is available.')

    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Update'))
    button!.click()
    expect(install).toHaveBeenCalled()
  })
})
