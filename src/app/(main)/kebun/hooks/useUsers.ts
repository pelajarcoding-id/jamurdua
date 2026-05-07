'use client'

import { useState, useEffect, useCallback } from 'react'
import { PekerjaanUser } from '../types'

interface UseUsersProps {
  kebunId: number
}

export function useUsers({ kebunId }: UseUsersProps) {
  const [users, setUsers] = useState<PekerjaanUser[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/karyawan?limit=1000`, { cache: 'no-store' })
      if (res.ok) {
        const responseData = await res.json()
        if (Array.isArray(responseData.data)) {
          setUsers(responseData.data)
        } else if (Array.isArray(responseData)) {
          setUsers(responseData)
        } else {
          setUsers([])
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [kebunId])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return { users, isLoading, refetch: fetchUsers }
}
