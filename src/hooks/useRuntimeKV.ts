import { useState, useEffect } from 'react'
import { runtime } from '@/lib/runtime/manager'

/**
 * Custom hook that works like Spark's useKV but uses our runtime abstraction
 * This allows the app to work both locally (localStorage) and on Spark platform
 */
export function useRuntimeKV<T>(key: string, defaultValue: T): [T, (value: T) => void] {
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
  const updateValue = async (newValue: T) => {
    setValue(newValue)
    await runtime.kv.set(key, newValue)
  }

  return [value, updateValue]
}
