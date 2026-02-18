import * as SelectPrimitive from '@radix-ui/react-select'
import { useMemo } from 'react'
import Button from './Button'
import type { ReactNode } from 'react'
import type { CSSProperties } from 'react'

export type Option = {
  value: string
  label: ReactNode
  description?: string
  className?: string
  valueClassName?: string
  valueStyle?: CSSProperties
  labelStyle?: CSSProperties
}

interface SelectProps {
  value: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const Select = ({ value, options, onChange, placeholder = 'Select...', className, disabled }: SelectProps) => {
  const selectedOption = useMemo(() => options.find((opt) => opt.value === value), [options, value])

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <div className={`select ${className ?? ''}`}>
        <SelectPrimitive.Trigger asChild>
          <Button type="button" className="select__trigger">
            <span className="select__trigger-text">
              {selectedOption ? (
                <span className="select__value">
                  <span
                    className={`select__value-label ${selectedOption.valueClassName ?? ''}`.trim()}
                    style={selectedOption.valueStyle}
                  >
                    {selectedOption.label}
                  </span>
                  {selectedOption.description ? (
                    <span className="select__value-description">{selectedOption.description}</span>
                  ) : null}
                </span>
              ) : (
                <span className="select__placeholder">{placeholder}</span>
              )}
            </span>
            <SelectPrimitive.Icon asChild>
              <div className="select__trigger-icon" aria-hidden />
            </SelectPrimitive.Icon>
          </Button>
        </SelectPrimitive.Trigger>
      </div>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select__menuPortal"
          position="popper"
          align="start"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport className="select__viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={`select__option ${option.className ?? ''}`.trim()}
              >
                <SelectPrimitive.ItemText asChild>
                  <div className="select__option-text">
                    <div className="select__option-label" style={option.labelStyle}>
                      {option.label}
                    </div>
                    {option.description ? (
                      <div className="select__option-description">{option.description}</div>
                    ) : null}
                  </div>
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export default Select
