// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PeopleCardSurface } from './PeopleCardSurface'
import { buildPeoplePresentationModel } from '../cards/lifeDesignAdapters'
import { PreferencesProvider } from '../../../shared/prefs/PreferencesProvider'

describe('PeopleCardSurface', () => {
  it('creates a person from the quick-add form on the card surface', async () => {
    const user = userEvent.setup()
    const onSaveItem = vi.fn()

    render(
      <PreferencesProvider>
        <PeopleCardSurface
          model={buildPeoplePresentationModel([])}
          items={[]}
          selected={null}
          selectedId={null}
          open={false}
          loading={false}
          onOpen={() => {}}
          onClose={() => {}}
          onSelectItem={() => {}}
          onSaveItem={onSaveItem}
          onRemoveItem={() => {}}
        />
      </PreferencesProvider>,
    )

    await user.type(screen.getByPlaceholderText('Name'), 'Ada Lovelace')
    await user.click(screen.getAllByRole('button', { name: /Add person/i }).find((button) => button.getAttribute('type') === 'submit')!)

    expect(onSaveItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ada Lovelace',
      group: 'Friends',
    }))
  })
})
