import { useEffect, useState } from 'react'

// The shop follows the real clock: morning sun, afternoon, sunset, night.
// Sets <html data-daypart="…">; index.css draws the matching sky layer.
// Checks the time once a minute — that's all the work it does.
// Try any part of the day with ?time=morning | afternoon | evening | night in the URL.

const PREVIEW_HOUR = { morning: 8, afternoon: 14, evening: 17, night: 22 }

function currentHour() {
  const forced = new URLSearchParams(window.location.search).get('time')
  if (forced in PREVIEW_HOUR) return PREVIEW_HOUR[forced]
  return new Date().getHours()
}

export function daypartOf(hour) {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 16) return 'afternoon'
  if (hour >= 16 && hour < 19) return 'evening'
  return 'night'
}

/** { hour, daypart }, refreshed every minute. */
export function useDaypart() {
  const [hour, setHour] = useState(currentHour)
  useEffect(() => {
    const timer = setInterval(() => setHour(currentHour()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const daypart = daypartOf(hour)
  useEffect(() => {
    document.documentElement.dataset.daypart = daypart
  }, [daypart])
  return { hour, daypart }
}
