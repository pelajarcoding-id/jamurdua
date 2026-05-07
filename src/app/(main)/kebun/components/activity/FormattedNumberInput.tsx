'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { formatIdNumber } from '@/lib/utils'

interface FormattedNumberInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function FormattedNumberInput({
  value,
  onChange,
  className,
  placeholder,
  disabled,
}: FormattedNumberInputProps) {
  const [localValue, setLocalValue] = useState('')

  useEffect(() => {
    const formatted = value === 0 ? '' : formatIdNumber(value)
    const currentDigits = localValue.replace(/\D/g, '')
    const valueDigits = value.toString().replace(/\D/g, '')

    if (currentDigits !== valueDigits) {
      setLocalValue(formatted)
    }
  }, [value])

  return (
    <Input
      value={localValue}
      onChange={(e) => {
        const raw = e.target.value
        const digits = raw.replace(/\D/g, '')
        const num = digits ? parseInt(digits, 10) : 0

        setLocalValue(num === 0 ? '' : formatIdNumber(num))
        onChange(num)
      }}
      className={className}
      placeholder={placeholder}
      inputMode="numeric"
      disabled={disabled}
    />
  )
}
