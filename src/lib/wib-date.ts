export function getCurrentWIBDateParts() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0')
  return {
    year: getPart('year'),
    month: getPart('month') - 1,
    day: getPart('day'),
  }
}

export function createWIBDate(year: number, month: number, day: number, isEnd: boolean = false) {
  const hour = isEnd ? 16 : -7
  const minute = isEnd ? 59 : 0
  const second = isEnd ? 59 : 0
  const ms = isEnd ? 999 : 0
  return new Date(Date.UTC(year, month, day, hour, minute, second, ms))
}

export function formatWIBDateForInput(date: Date | undefined) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function parseWIBDateFromInput(dateStr: string, isEnd: boolean = false) {
  if (!dateStr) return undefined
  const [year, month, day] = dateStr.split('-').map(Number)
  return createWIBDate(year, month - 1, day, isEnd)
}

export function formatWIBDateDisplay(value: string) {
  try {
    const d = new Date(value)
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(d)
  } catch {
    return value
  }
}

