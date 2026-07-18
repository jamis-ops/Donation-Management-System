/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useApiList(fetchFn, refreshKey) {
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchRef.current()
      setData(res.data ?? res)
    } catch (err) {
      setError(err.message || 'Failed to load data')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return { data, loading, error, reload, setData }
}

export function useApiObject(fetchFn, refreshKey) {
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchRef.current()
      setData(res.data ?? res)
    } catch (err) {
      setError(err.message || 'Failed to load data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return { data, loading, error, reload }
}
