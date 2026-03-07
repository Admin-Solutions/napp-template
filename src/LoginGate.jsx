import { useState, useEffect, useRef } from 'react'
import { mountAuth } from './LazyAuth'

const isAuthenticated = () => !!window.__BOOTSTRAP__?.USER_ACCESS_TOKEN

export function LoginGate({ children }) {
  const [authed, setAuthed] = useState(isAuthenticated)
  const containerRef = useRef(null)
  const mountedRef = useRef(null)

  useEffect(() => {
    if (authed || !containerRef.current) return

    mountAuth(containerRef.current, {
      onSuccess: async () => {
        // In dev: refresh bootstrap so vite injects fresh auth, then reload
        // In prod: reload so server reinjects __BOOTSTRAP__ with session
        if (import.meta.env.DEV) {
          await fetch('/__dev/refresh-bootstrap', { method: 'POST' }).catch(() => {})
        }
        window.location.reload()
      },
      onClose: () => {
        // Modal dismissed without login — nothing to do, gate stays up
      },
    }).then(instance => {
      mountedRef.current = instance
    })

    return () => {
      mountedRef.current?.unmount()
    }
  }, [authed])

  if (!authed) {
    return <div id="smn-auth-root" ref={containerRef} />
  }

  return children
}
