import { describe, expect, it } from 'vitest'
import { extractSyncErrorMessage } from './rxdb'

describe('extractSyncErrorMessage', () => {
  it('prefers nested rxdb push errors over the generic RC_PUSH wrapper', () => {
    const message = extractSyncErrorMessage({
      parameters: {
        errors: [
          { message: 'Sync request failed: 500' },
        ],
      },
      message: 'generic',
    })

    expect(message).toBe('Sync request failed: 500')
  })
})
