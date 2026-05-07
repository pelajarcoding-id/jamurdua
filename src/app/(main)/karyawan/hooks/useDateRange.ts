'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { getCurrentWIBDateParts } from '@/lib/wib-date'

export function useDateRange() {
  const { year, month, day } = getCurrentWIBDateParts()
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [quickRange, setQuickRange] = useState('this_year')

  // Date display formatting
  const dateDisplay = useMemo(() => {
    if (startDate && endDate) {
      const s = new Date(`${startDate}T00:00:00+07:00`)
      const e = new Date(`${endDate}T00:00:00+07:00`)
      return `${format(s, 'dd MMM yyyy', { locale: idLocale })} - ${format(e, 'dd MMM yyyy', { locale: idLocale })}`
    }
    return 'Pilih periode'
  }, [startDate, endDate])

  // Apply quick range
  const applyQuickRange = useCallback((val: string) => {
    setQuickRange(val)
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    
    if (val === 'today') {
      const d = format(now, 'yyyy-MM-dd')
      setStartDate(d)
      setEndDate(d)
    } else if (val === 'this_week') {
      const dayOfWeek = now.getDay()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      setStartDate(format(startOfWeek, 'yyyy-MM-dd'))
      setEndDate(format(endOfWeek, 'yyyy-MM-dd'))
    } else if (val === 'this_month') {
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0)
      setStartDate(format(start, 'yyyy-MM-dd'))
      setEndDate(format(end, 'yyyy-MM-dd'))
    } else if (val === 'last_month') {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      setStartDate(format(start, 'yyyy-MM-dd'))
      setEndDate(format(end, 'yyyy-MM-dd'))
    } else if (val === 'this_year') {
      setStartDate(`${y}-01-01`)
      setEndDate(`${y}-12-31`)
    } else if (val === 'last_year') {
      setStartDate(`${y - 1}-01-01`)
      setEndDate(`${y - 1}-12-31`)
    }
  }, [])

  // Initialize default
  useEffect(() => {
    if (!startDate || !endDate) {
      applyQuickRange('this_year')
    }
  }, [])

  // Format date key helper
  const formatDateKey = useCallback((d: Date) => new Intl.DateTimeFormat('en-CA').format(d), [])

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    quickRange,
    setQuickRange,
    dateDisplay,
    applyQuickRange,
    formatDateKey,
    currentMonthStr,
  }
}
