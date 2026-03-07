import { useRef } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
import { mountLogout, mountSwitchAccounts } from './LazyAuth'

const bootstrap = () => window.__BOOTSTRAP__ || {}

export default function App() {
  const logoutRef = useRef(null)
  const switchRef = useRef(null)

  function handleLogout() {
    if (!logoutRef.current) return
    mountLogout(logoutRef.current, {
      onSuccess: () => window.location.reload(),
      onClose: () => { logoutRef.current.innerHTML = '' },
    })
  }

  function handleSwitchAccounts() {
    if (!switchRef.current) return
    mountSwitchAccounts(switchRef.current, {
      onClose: () => { switchRef.current.innerHTML = '' },
    })
  }

  const b = bootstrap()
  const walletName = b.WALLET_LOGGED_INTO_USER_NAME || b.WALLET_NAME_USER || 'Wallet'

  return (
    <div className="min-h-screen flex flex-col bg-nexus-900">

      {/* Header */}
      <header className="border-b border-surface-border bg-nexus-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-text-primary font-semibold text-lg">My Napp</span>

          <div className="flex items-center gap-3">
            <span className="text-text-muted text-sm hidden sm:block">{walletName}</span>

            <button
              onClick={handleSwitchAccounts}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Switch</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Auth modal containers */}
      <div ref={logoutRef} />
      <div ref={switchRef} />

      {/* Main content — replace this with your app */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-3">Napp Template</h1>
          <p className="text-text-secondary text-sm max-w-xs mx-auto">
            Start building here. Replace this content with your app.
          </p>
        </div>
      </main>

    </div>
  )
}
