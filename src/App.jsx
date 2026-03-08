import { LogOut, Users, Lock } from 'lucide-react'
import { mountAuth, mountLogout, mountSwitchAccounts } from './LazyAuth'

const bootstrap = () => window.__BOOTSTRAP__ || {}

function mountInBody(mountFn) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const onClose = () => { try { document.body.removeChild(container) } catch (_) {} }
  return { container, onClose }
}

export default function App() {
  const b = bootstrap()
  const walletName = b.WALLET_LOGGED_INTO_USER_NAME || b.WALLET_NAME_USER || ''
  const isAuthed = b.IS_AUTHORIZED_USER === true || b.IS_AUTHORIZED_USER === 'true'

  async function handleLogin() {
    const { container, onClose } = mountInBody()
    try {
      await mountAuth(container, {
        onSuccess: async () => {
          if (import.meta.env.DEV) {
            await fetch('/__dev/refresh-bootstrap', { method: 'POST' }).catch(() => {})
          }
          window.location.reload()
        },
        onClose,
      })
    } catch (e) {
      console.error('[Login] mountAuth failed:', e)
      onClose()
    }
  }

  async function handleLogout() {
    const { container, onClose } = mountInBody()
    try {
      await mountLogout(container, {
        onSuccess: () => window.location.reload(),
        onClose,
      })
    } catch (e) {
      console.error('[Logout] mountLogout failed:', e)
      onClose()
    }
  }

  async function handleSwitch() {
    const { container, onClose } = mountInBody()
    try {
      await mountSwitchAccounts(container, {
        onBeforeReload: import.meta.env.DEV
          ? async (walletGUID) => {
              const url = walletGUID ? `/__dev/refresh-bootstrap?walletGuid=${walletGUID}` : '/__dev/refresh-bootstrap'
              await fetch(url, { method: 'POST' }).catch(() => {})
            }
          : undefined,
        onClose,
      })
    } catch (e) {
      console.error('[Switch] mountSwitchAccounts failed:', e)
      onClose()
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-nexus-900">

      {/* Header */}
      <header className="border-b border-surface-border bg-nexus-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-text-primary font-semibold text-lg">My Napp</span>

          <div className="flex items-center gap-3">
            {isAuthed ? (
              <>
                {walletName && (
                  <span className="text-text-muted text-xs font-mono px-3 py-1.5 rounded-lg hidden sm:flex items-center gap-2"
                    style={{ background: '#0f0f1a', border: '1px solid #1e1e30' }}>
                    {walletName}
                  </span>
                )}
                <button
                  onClick={handleSwitch}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
                  style={{ background: '#1a1a28', border: '1px solid #2a2a3a' }}
                >
                  <Users size={11} />
                  Switch
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                  style={{ background: '#ff000010', border: '1px solid #ff000030' }}
                >
                  <LogOut size={11} />
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white transition-colors"
                style={{ background: '#6366f120', border: '1px solid #6366f140' }}
              >
                <Lock size={11} />
                Login
              </button>
            )}
          </div>
        </div>
      </header>

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
