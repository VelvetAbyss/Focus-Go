import { useCallback, useState } from 'react'
import SalarySettingsDialog from './SalarySettingsDialog'

/** The pay settings dialog, remounted on every opening so it starts from what's saved. */
export const useSettingsDialog = () => {
  const [state, setState] = useState({ open: false, key: 0 })
  const openSettings = useCallback(() => setState((current) => ({ open: true, key: current.key + 1 })), [])
  const close = useCallback(() => setState((current) => ({ ...current, open: false })), [])
  return {
    openSettings,
    settingsDialog: <SalarySettingsDialog key={state.key} open={state.open} onClose={close} />,
  }
}
