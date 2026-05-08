'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export function useDateRange() {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [quickRange, setQuickRange] = useState('this_year')

  const dateDisplay = useMemo(() => {
    if (startDate && endDate) {
      const s = new Date(`${startDate}T00:00:00+07:00`)
      const e = new Date(`${endDate}T00:00:00+07:00`)
      return `${format(s, 'dd MMM yyyy', { locale: idLocale })} - ${format(e, 'dd MMM yyyy', { locale: idLocale })}`
    }
    return 'Pilih periode'
  }, [startDate, endDate])

  const formatDateKey = useCallback((d: Date) => new Intl.DateTimeFormat('en-CA').format(d), [])

  const applyQuickRange = useCallback((val: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setQuickRange(val)
    let start = today
    let end = today
    if (val === 'yesterday') {
      const y = new Date(today)
      y.setDate(today.getDate() - 1)
      start = y
      end = y
    } else if (val === 'last_week') {
      const s = new Date(today)
      s.setDate(today.getDate() - 7)
      start = s
      end = today
    } else if (val === 'last_30_days') {
      const s = new Date(today)
      s.setDate(today.getDate() - 30)
      start = s
      end = today
    } else if (val === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = today
    } else if (val === 'this_year') {
      start = new Date(today.getFullYear(), 0, 1)
      end = today
    }
    const startVal = formatDateKey(start)
    const endVal = formatDateKey(end)
    setStartDate(startVal)
    setEndDate(endVal)
  }, [formatDateKey])

  useEffect(() => {
    if (!startDate || !endDate) {
      applyQuickRange('this_year')
    }
  }, [])

  return {
    startDate, setStartDate,
    endDate, setEndDate,
    quickRange, setQuickRange,
    dateDisplay,
    formatDateKey,
    applyQuickRange,
  }
}
