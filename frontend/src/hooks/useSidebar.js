import { useState, useCallback } from "react"

const KEY = "gex.sidebar.collapsed"

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "true"
    } catch {
      return false
    }
  })

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(KEY, String(next)) } catch {}
      return next
    })
  }, [])

  return [collapsed, toggle]
}
