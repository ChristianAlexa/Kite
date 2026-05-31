import { format } from 'date-fns'

// Shape scored daytime hours into an aligned day × clock-hour grid for the week
// heatmap. Pure — no React, no presentation. Columns are the union of daylight
// clock hours so every day row lines up; missing hours (night / out of range)
// become null cells.
export function buildWeekGrid(scoredHours, now = new Date()) {
  const daytime = (scoredHours || []).filter((h) => h.isDay)
  if (daytime.length === 0) return { columns: [], rows: [], nowHour: null }

  const hoursOfDay = daytime.map((h) => new Date(h.time).getHours())
  const minH = Math.min(...hoursOfDay)
  const maxH = Math.max(...hoursOfDay)
  const columns = []
  for (let h = minH; h <= maxH; h++) columns.push(h)

  // Current hour, but only if it's a daylight column we actually render — at
  // night there's no column to anchor "now" to.
  const h = now.getHours()
  const nowHour = h >= minH && h <= maxH ? h : null
  const todayKey = format(now, 'yyyy-MM-dd')

  const byDay = new Map()
  for (const h of daytime) {
    const d = new Date(h.time)
    const key = format(d, 'yyyy-MM-dd')
    if (!byDay.has(key)) {
      byDay.set(key, { key, date: d, label: format(d, 'EEE'), sub: format(d, 'M/d'), hours: {} })
    }
    byDay.get(key).hours[d.getHours()] = h
  }

  const rows = [...byDay.values()]
    .sort((a, b) => a.date - b.date)
    .map((day) => ({
      key: day.key,
      label: day.label,
      sub: day.sub,
      isToday: day.key === todayKey,
      cells: columns.map((col) => day.hours[col] || null),
    }))

  return { columns, rows, nowHour }
}
