import { useState, useEffect } from 'react'
import { runtime } from '@/lib/runtime/manager'

/**
 * Custom hook that works like Spark's useKV but uses our runtime abstraction
 * This allows the app to work both locally (localStorage) and on Spark platform
 */
type Updater<T> = T | ((prev: T) => T)

export function useRuntimeKV<T>(key: string, defaultValue: T): [T, (value: Updater<T>) => void] {
  const [value, setValue] = useState<T>(defaultValue)
  const [initialized, setInitialized] = useState(false)

  // Load initial value from storage
  useEffect(() => {
    const loadValue = async () => {
      const stored = await runtime.kv.get<T>(key)
      if (stored !== null) {
        setValue(stored)
      }
      setInitialized(true)
    }
    loadValue()
  }, [key])

  // Update storage when value changes
  const updateValue = async (newValue: Updater<T>) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function' ? (newValue as (p: T) => T)(prev) : newValue
      // Persist in background; no need to block render
      runtime.kv.set(key, resolved).catch((err) => console.warn('KV set failed', err))
      return resolved
    })
  }

  return [value, updateValue]
}
