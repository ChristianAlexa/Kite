import { useCallback, useEffect, useRef, useState } from 'react'
import { headingFromEvent, smoothHeading } from '../lib/compass.js'

// Live device-compass heading, opt-in. Owns the browser-specific mess —
// permission gating and the two flavours of orientation event — and hands the
// component a smoothed true-north heading plus a status it can render against.
//
// status:
//   'unsupported' — no DeviceOrientationEvent in this browser
//   'prompt'      — iOS; needs a user gesture to call requestPermission
//   'idle'        — supported, no prompt needed (Android); not yet listening
//   'granted'     — listening; `heading` updates live
//   'denied'      — user refused the iOS permission
export default function useCompassHeading() {
  const [status, setStatus] = useState('idle')
  const [heading, setHeading] = useState(null)
  const smoothed = useRef(null)

  // Feature-detect once on mount.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) {
      setStatus('unsupported')
    } else if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      setStatus('prompt')
    } else {
      setStatus('idle')
    }
  }, [])

  // Attach listeners whenever we hold permission; detach on cleanup.
  useEffect(() => {
    if (status !== 'granted') return undefined

    const onOrient = (event) => {
      const h = headingFromEvent(event)
      if (h == null) return
      smoothed.current = smoothHeading(smoothed.current, h)
      setHeading(smoothed.current)
    }

    // Android fires deviceorientationabsolute; iOS fires deviceorientation with
    // webkitCompassHeading. Listening to both is harmless — headingFromEvent
    // ignores any event without an absolute heading.
    window.addEventListener('deviceorientationabsolute', onOrient)
    window.addEventListener('deviceorientation', onOrient)
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrient)
      window.removeEventListener('deviceorientation', onOrient)
    }
  }, [status])

  const request = useCallback(async () => {
    if (status === 'unsupported' || status === 'granted') return
    const DOE = window.DeviceOrientationEvent
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission()
        setStatus(res === 'granted' ? 'granted' : 'denied')
      } catch {
        setStatus('denied')
      }
    } else {
      setStatus('granted')
    }
  }, [status])

  return { heading, status, request }
}
