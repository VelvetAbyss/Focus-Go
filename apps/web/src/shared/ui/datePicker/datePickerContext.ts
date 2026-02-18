import * as React from 'react'

export type OpenDatePickerParams = {
  anchorEl: HTMLElement
  value?: string | null
  onChange: (dateKey: string | null) => void
}

export type DatePickerContextValue = {
  open: (params: OpenDatePickerParams) => void
  close: () => void
  isOpenFor: (anchorEl: HTMLElement | null) => boolean
}

export const DatePickerContext = React.createContext<DatePickerContextValue | null>(null)

export const useDatePicker = () => {
  const ctx = React.useContext(DatePickerContext)
  if (!ctx) throw new Error('useDatePicker must be used within DatePickerProvider')
  return ctx
}
