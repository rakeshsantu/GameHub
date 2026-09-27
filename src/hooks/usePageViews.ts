import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_BASE ?? '/api'

/**
 * Increments the page-view counter once on mount (POST),
 * then returns the latest total count.
 */
export function usePageViews() {
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API}/page_views.php`, { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (!cancelled) setViews(d.views ?? null) })
      .catch(() => {/* silent — counter is non-critical */})
    return () => { cancelled = true }
  }, [])

  return views
}
