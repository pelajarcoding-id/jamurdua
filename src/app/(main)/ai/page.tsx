'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import RoleGate from '@/components/RoleGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import toast from 'react-hot-toast'
import { FingerPrintIcon, PaperAirplaneIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

type TablePayload = {
  title: string
  columns: string[]
  rows: Array<Array<string | number | null>>
}

function shouldHideTablePayload(title: string) {
  const t = String(title || '').toLowerCase()
  if (!t) return false
  if (t.startsWith('schema ')) return true
  if (t.includes('internal')) return true
  if (t.includes('model prisma')) return true
  if (t.includes('model tersedia')) return true
  return false
}

function tableLabel(idx: number, total: number) {
  return total > 1 ? `Data ${idx + 1}` : 'Data'
}

function readMemoryNotes(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((x: any) => String(x || '').trim()).filter(Boolean).slice(-MAX_SAVED_MEMORY)
  } catch {
    return []
  }
}

function writeMemoryNotes(list: string[]) {
  if (typeof window === 'undefined') return
  try {
    const compact = (list || [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(-MAX_SAVED_MEMORY)
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(compact))
  } catch {}
}

type ChatResponse = {
  answer: string
  tables: TablePayload[]
  reasoning?: string[]
}

type ChatHistoryItem = { role: 'user' | 'assistant'; content: string }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  tables: TablePayload[]
  reasoning?: string[]
  status?: 'pending' | 'done' | 'error'
  createdAt: number
}

type ChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const SESSIONS_STORAGE_KEY = 'ai_chat_sessions_v1'
const CURRENT_SESSION_STORAGE_KEY = 'ai_chat_current_session_v1'
const MEMORY_STORAGE_KEY = 'ai_chat_memory_v1'
const MAX_SAVED_SESSIONS = 30
const MAX_SAVED_MESSAGES = 80
const MAX_SAVED_MEMORY = 20

function makeId() {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeTitle(v: string) {
  const s = String(v || '').replace(/\s+/g, ' ').trim()
  if (!s) return 'Chat baru'
  return s.length > 44 ? `${s.slice(0, 44)}…` : s
}

function createSession(): ChatSession {
  const now = Date.now()
  return { id: makeId(), title: 'Chat baru', createdAt: now, updatedAt: now, messages: [] }
}

function readSavedSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const sessions = parsed
      .map((s: any) => {
        const id = String(s?.id || makeId())
        const createdAt = Number.isFinite(Number(s?.createdAt)) ? Number(s.createdAt) : Date.now()
        const updatedAt = Number.isFinite(Number(s?.updatedAt)) ? Number(s.updatedAt) : createdAt
        const title = normalizeTitle(String(s?.title || 'Chat baru'))
        const msgsRaw = Array.isArray(s?.messages) ? s.messages : []
        const messages = msgsRaw
          .filter((m: any) => m && m.status !== 'pending')
          .map((m: any) => ({
            id: String(m?.id || makeId()),
            role: (m?.role === 'assistant' ? 'assistant' : 'user') as ChatMessage['role'],
            text: String(m?.text || ''),
            tables: (Array.isArray(m?.tables) ? m.tables : []) as TablePayload[],
            reasoning: Array.isArray(m?.reasoning) ? (m.reasoning as any[]).map((x: any) => String(x || '')).filter(Boolean) : undefined,
            status: (m?.status === 'error' ? 'error' : 'done') as ChatMessage['status'],
            createdAt: Number.isFinite(Number(m?.createdAt)) ? Number(m.createdAt) : Date.now(),
          }))
          .slice(-MAX_SAVED_MESSAGES)
        return { id, title, createdAt, updatedAt, messages }
      })
      .slice(-MAX_SAVED_SESSIONS)
    return sessions
  } catch {
    return []
  }
}

function writeSavedSessions(list: ChatSession[], currentSessionId: string) {
  if (typeof window === 'undefined') return
  try {
    const compact = (list || [])
      .slice(-MAX_SAVED_SESSIONS)
      .map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages: (s.messages || [])
          .filter((m) => m && m.status !== 'pending')
          .slice(-MAX_SAVED_MESSAGES)
          .map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            tables: m.tables,
            status: m.status === 'error' ? 'error' : 'done',
            createdAt: m.createdAt,
          })),
      }))
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(compact))
    window.localStorage.setItem(CURRENT_SESSION_STORAGE_KEY, String(currentSessionId || ''))
  } catch {}
}

function readCurrentSessionId(existing: ChatSession[]) {
  if (typeof window === 'undefined') return null
  try {
    const id = String(window.localStorage.getItem(CURRENT_SESSION_STORAGE_KEY) || '').trim()
    if (id && existing.some((s) => s.id === id)) return id
  } catch {}
  if (existing.length === 0) return null
  const sorted = [...existing].sort((a, b) => b.updatedAt - a.updatedAt)
  return sorted[0]?.id || null
}

export default function AiPage() {
  const [message, setMessage] = useState('')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const sessionsReadyRef = useRef(false)
  const baselineMsgLenRef = useRef<number | null>(null)
  const [showHistoryMobile, setShowHistoryMobile] = useState(false)

  useEffect(() => {
    const loaded = readSavedSessions()
    if (loaded.length === 0) {
      setSessions([])
      setActiveSessionId('')
      sessionsReadyRef.current = true
      return
    }
    setSessions(loaded)
    const id = readCurrentSessionId(loaded)
    setActiveSessionId(id || loaded[0].id)
    sessionsReadyRef.current = true
  }, [])

  useEffect(() => {
    if (!activeSessionId) return
    if (sessions.length === 0) return
    writeSavedSessions(sessions, activeSessionId)
  }, [sessions, activeSessionId])

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) || null, [sessions, activeSessionId])
  const messages = activeSession?.messages || []

  useEffect(() => {
    if (!sessionsReadyRef.current) return
    baselineMsgLenRef.current = null
  }, [activeSessionId])

  useEffect(() => {
    if (!sessionsReadyRef.current) return
    if (baselineMsgLenRef.current === null) {
      baselineMsgLenRef.current = messages.length
      return
    }
    if (messages.length > baselineMsgLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    baselineMsgLenRef.current = messages.length
  }, [messages.length])

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [sessions])

  const ask = async () => {
    const q = String(message || '').trim()
    if (!q) return
    let sessionId = activeSessionId
    if (!sessionId) {
      const s = createSession()
      sessionId = s.id
      setSessions((prev) => [s, ...prev].slice(0, MAX_SAVED_SESSIONS))
      setActiveSessionId(s.id)
    }

    const memAddMatch = q.match(/^ingat\s*:\s*(.+)$/i) || q.match(/^\/ingat\s+(.+)$/i)
    if (memAddMatch?.[1]) {
      const note = String(memAddMatch[1] || '').trim()
      if (note) {
        const prev = readMemoryNotes()
        const next = [...prev, note].slice(-MAX_SAVED_MEMORY)
        writeMemoryNotes(next)
        toast.success('Catatan disimpan.')
      }
      setMessage('')
      return
    }
    const memClear = /^\/lupa\b/i.test(q) || /^lupa\s*semua\b/i.test(q)
    if (memClear) {
      writeMemoryNotes([])
      toast.success('Catatan dihapus.')
      setMessage('')
      return
    }

    setLoading(true)
    setMessage('')
    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: q,
      tables: [],
      status: 'done',
      createdAt: Date.now(),
    }
    const assistantId = makeId()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      tables: [],
      status: 'pending',
      createdAt: Date.now(),
    }
    setShowHistoryMobile(false)
    setSessions((prev) =>
      (() => {
        const now = Date.now()
        let found = false
        const next = prev.map((s) => {
          if (s.id !== sessionId) return s
          found = true
          const nextMessages = [...(s.messages || []), userMsg, assistantMsg].slice(-MAX_SAVED_MESSAGES)
          const title = (s.messages || []).length === 0 ? normalizeTitle(q) : s.title
          return { ...s, title, messages: nextMessages, updatedAt: now }
        })
        if (found) return next
        const s = { ...createSession(), id: sessionId, title: normalizeTitle(q), messages: [userMsg, assistantMsg], updatedAt: now, createdAt: now }
        return [s, ...next].slice(0, MAX_SAVED_SESSIONS)
      })(),
    )
    try {
      const history: ChatHistoryItem[] = (activeSession?.messages || [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.status !== 'pending')
        .slice(-24)
        .map((m) => ({ role: m.role, content: String(m.text || '').trim() }))
        .filter((m) => Boolean(m.content))
      const memories = readMemoryNotes()
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history, memories }),
      })
      const json = (await res.json().catch(() => ({}))) as Partial<ChatResponse> & { error?: string }
      if (!res.ok) throw new Error(json?.error || 'Gagal memproses pertanyaan')
      const text = String(json?.answer || '')
      const tables = Array.isArray(json?.tables) ? (json.tables as any) : []
      const reasoning = Array.isArray((json as any)?.reasoning)
        ? ((json as any).reasoning as any[]).map((x: any) => String(x || '').trim()).filter(Boolean)
        : undefined
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s
          const nextMessages = (s.messages || []).map((m) =>
            m.id === assistantId ? { ...m, text, tables, reasoning, status: 'done' as const } : m,
          )
          return { ...s, messages: nextMessages, updatedAt: Date.now() }
        }),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memproses pertanyaan'
      toast.error(msg)
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s
          const nextMessages = (s.messages || []).map((m) =>
            m.id === assistantId ? { ...m, text: msg, tables: [], status: 'error' as const } : m,
          )
          return { ...s, messages: nextMessages, updatedAt: Date.now() }
        }),
      )
    } finally {
      setLoading(false)
    }
  }

  const createNewChat = () => {
    const s = createSession()
    setSessions((prev) => [s, ...prev].slice(0, MAX_SAVED_SESSIONS))
    setActiveSessionId(s.id)
    setShowHistoryMobile(false)
  }

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0) {
        setActiveSessionId('')
        return []
      }
      if (id === activeSessionId) {
        const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt)
        setActiveSessionId(sorted[0].id)
      }
      return next
    })
  }

  return (
    <RoleGate allow={['ADMIN']}>
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex min-h-[78vh] min-w-0">
              {sessions.length > 0 ? (
                <div className="hidden md:flex w-[280px] shrink-0 border-r border-gray-100 bg-gray-50/40 flex-col">
                <div className="p-4 border-b border-gray-100">
                  <Button type="button" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={createNewChat}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Chat Baru
                  </Button>
                </div>
                <div className="p-2 overflow-y-auto grow space-y-1">
                  {sortedSessions.map((s) => {
                    const active = s.id === activeSessionId
                    return (
                      <div key={s.id} className="group flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => setActiveSessionId(s.id)}
                          className={[
                            'flex-1 min-w-0 text-left px-3 py-2 rounded-xl border text-sm',
                            active ? 'bg-white border-emerald-200 text-gray-900' : 'bg-white/60 border-transparent text-gray-700 hover:bg-white',
                          ].join(' ')}
                          title={s.title}
                        >
                          <div className="font-medium whitespace-normal break-words leading-snug">{s.title}</div>
                          <div className="text-[11px] text-gray-500">{new Date(s.updatedAt).toLocaleString('id-ID')}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSession(s.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50"
                          aria-label="Hapus chat"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                </div>
              ) : null}

              <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 md:p-6 border-b border-gray-100 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <FingerPrintIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-gray-900 truncate">{activeSession?.title || 'AI'}</div>
                    <div className="text-xs text-gray-500">Tanya apa saja. Data DB: AI pakai tools.</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {sessions.length > 0 ? (
                      <>
                        <Button type="button" variant="outline" className="rounded-full md:hidden" onClick={() => setShowHistoryMobile((v) => !v)}>
                          Riwayat
                        </Button>
                        <Button type="button" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={createNewChat}>
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Baru
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                {showHistoryMobile ? (
                  <div className="md:hidden border-b border-gray-100 bg-gray-50/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900">Riwayat</div>
                      <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowHistoryMobile(false)}>
                        Tutup
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                      {sortedSessions.map((s) => {
                        const active = s.id === activeSessionId
                        return (
                          <div key={s.id} className="group flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSessionId(s.id)
                                setShowHistoryMobile(false)
                              }}
                              className={[
                                'flex-1 min-w-0 text-left px-3 py-2 rounded-xl border text-sm',
                                active ? 'bg-white border-emerald-200 text-gray-900' : 'bg-white/60 border-transparent text-gray-700 hover:bg-white',
                              ].join(' ')}
                              title={s.title}
                            >
                              <div className="font-medium whitespace-normal break-words leading-snug">{s.title}</div>
                              <div className="text-[11px] text-gray-500">{new Date(s.updatedAt).toLocaleString('id-ID')}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSession(s.id)}
                              className="p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50"
                              aria-label="Hapus chat"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="p-4 md:p-6 space-y-4 flex-1 flex flex-col min-w-0">
                  <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/40 p-3 md:p-4 space-y-3 min-w-0">
                    {sessions.length === 0 ? (
                      <div className="h-full min-h-[50vh] flex items-center justify-center">
                        <Button type="button" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-5" onClick={createNewChat}>
                          <PlusIcon className="h-5 w-5 mr-3" />
                          Tambah Chat
                        </Button>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-10">Mulai chat.</div>
                    ) : null}

                    {messages.map((m) => {
                      const isUser = m.role === 'user'
                      return (
                        <div key={m.id} className={`flex min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={[
                              'max-w-[92%] md:max-w-[78%] min-w-0 overflow-hidden rounded-2xl px-4 py-3 text-sm shadow-sm border',
                              isUser
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : m.status === 'error'
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : 'bg-white text-gray-900 border-gray-100',
                            ].join(' ')}
                          >
                            {m.status === 'pending' ? (
                              <div className="space-y-2">
                                <div className="h-3 w-44 bg-gray-200 rounded animate-pulse" />
                                <div className="h-3 w-28 bg-gray-200 rounded animate-pulse" />
                              </div>
                            ) : (
                              <>
                                {m.text ? <div className="whitespace-pre-wrap break-words">{m.text}</div> : null}
                                {!isUser && Array.isArray(m.reasoning) && m.reasoning.length > 0 ? (
                                  <details className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                                    <summary className="cursor-pointer text-xs font-semibold text-gray-700">Rasional ambil data</summary>
                                    <div className="mt-2 space-y-1">
                                      {m.reasoning.slice(0, 20).map((r, i) => (
                                        <div key={`${m.id}-rs-${i}`} className="text-xs text-gray-700">
                                          - {r}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                ) : null}
                                {(m.tables || []).filter((t) => !shouldHideTablePayload(t.title)).map((t, idx, arr) => (
                                  <div key={`${m.id}-t-${idx}`} className="mt-3 rounded-xl border border-gray-100 overflow-hidden">
                                    <div className="px-3 py-2 text-xs font-semibold bg-gray-50 text-gray-900">{tableLabel(idx, arr.length)}</div>
                                    <div className="w-full max-w-full overflow-x-auto bg-white">
                                      <Table className="w-max">
                                        <TableHeader className="bg-gray-50">
                                          <TableRow>
                                            {t.columns.map((c, i) => (
                                              <TableHead key={`${m.id}-h-${idx}-${i}`} className="whitespace-nowrap text-xs">
                                                {c}
                                              </TableHead>
                                            ))}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {(t.rows || []).map((r, ri) => (
                                            <TableRow key={`${m.id}-r-${idx}-${ri}`}>
                                              {(r || []).map((c, ci) => (
                                                <TableCell key={`${m.id}-${idx}-${ri}-${ci}`} className="whitespace-nowrap text-xs">
                                                  {c == null ? '' : String(c)}
                                                </TableCell>
                                              ))}
                                            </TableRow>
                                          ))}
                                          {(t.rows || []).length === 0 ? (
                                            <TableRow>
                                              <TableCell colSpan={t.columns.length} className="text-center text-xs text-gray-500 py-6">
                                                Tidak ada data.
                                              </TableCell>
                                            </TableRow>
                                          ) : null}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </div>

                  <div className="flex items-end gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tulis pesan... (Enter untuk kirim)"
                      className="rounded-2xl"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') ask()
                      }}
                    />
                    <Button
                      type="button"
                      className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                      onClick={ask}
                      disabled={loading || !activeSessionId}
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      {loading ? '...' : 'Kirim'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGate>
  )
}
