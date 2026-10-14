// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlatform, setPlatform, type PlatformBridge } from '../../../platform'

const createMock = vi.fn()
const pushMock = vi.fn()
const emitMock = vi.fn()

vi.mock('./taskActions', () => ({ createTaskFromQuickInput: (raw: string) => createMock(raw) }))
vi.mock('../taskSync', () => ({ emitTasksChanged: (source: string) => emitMock(source) }))
vi.mock('../../../shared/ui/toast/toast', () => ({ useToast: () => ({ push: pushMock }) }))
vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ language: 'zh', t: (key: string, values?: Record<string, string>) => `${key}:${values?.title ?? values?.text ?? ''}` }),
}))

import { useQuickCapture } from './useQuickCapture'

describe('useQuickCapture', () => {
  const original = getPlatform()
  let capture: ((text: string) => void) | null = null
  const setUiLanguage = vi.fn(async () => {})

  beforeEach(() => {
    capture = null
    createMock.mockReset()
    pushMock.mockReset()
    setPlatform({
      ...original,
      setUiLanguage,
      onQuickCapture: (handler) => {
        capture = handler
        return () => {
          capture = null
        }
      },
    } as PlatformBridge)
  })

  afterEach(() => setPlatform(original))

  it('tells the shell the app language and files captured lines as tasks', async () => {
    createMock.mockResolvedValue({ id: 't1', title: '给 Lowe’s 回电话' })
    const { unmount } = renderHook(() => useQuickCapture())
    expect(setUiLanguage).toHaveBeenCalledWith('zh')

    capture?.('明天 3pm 给 Lowe’s 回电话')
    await waitFor(() => expect(pushMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith('明天 3pm 给 Lowe’s 回电话')
    expect(emitMock).toHaveBeenCalledWith('quick-capture')
    expect(pushMock).toHaveBeenCalledWith({ variant: 'success', message: 'tasks.quickCapture.saved:给 Lowe’s 回电话' })

    unmount()
    expect(capture).toBeNull()
  })

  it('keeps the words in the error toast when the task cannot be saved', async () => {
    createMock.mockRejectedValue(new Error('disk full'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useQuickCapture())
    capture?.('买牛奶')
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith({ variant: 'error', message: 'tasks.quickCapture.failed:买牛奶' }))
  })
})
