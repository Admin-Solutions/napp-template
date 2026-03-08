# Migrating an existing NAPP to seemynft-dev-proxy

Migrate this repo to use the shared `seemynft-dev-proxy` Vite plugin and `seemynft-auth` CDN bundle for login, logout, and switch accounts. Follow these steps exactly.

**Reference implementation:** `C:\Users\charl\OneDrive\Documents\repos\napp-template`

---

## Step 1 — Install the proxy package

```bash
npm install github:Admin-Solutions/seemynft-dev-proxy --save-dev
```

---

## Step 2 — Replace `vite.config.js`

Read the existing `vite.config.js` and identify:
- The env var name used for the token/wallet GUID (e.g. `VITE_EVENT_ORGANIZER_TOKEN_GUID`)
- The server port
- Whether it's a `token` page (`/mytoken/{guid}`) or `wallet` page (`/{guid}`)
- Any `manualChunks` or other build options to keep

Then replace the entire proxy/bootstrap/cookie logic with `seemynftDevProxy()`. Keep only what's genuinely specific to this repo (port, build options, etc.):

```js
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { seemynftDevProxy } from 'seemynft-dev-proxy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [
      tailwindcss(),
      react(),
      mode === 'development' && seemynftDevProxy({
        guid: env.VITE_YOUR_GUID_VAR,  // ← use the actual env var name from this repo
        type: 'token',                  // ← 'token' or 'wallet'
      }),
    ].filter(Boolean),
    server: {
      port: 5173,  // ← keep existing port
      open: env.VITE_YOUR_GUID_VAR ? `/mytoken/${env.VITE_YOUR_GUID_VAR}` : true,
    },
    // ← keep any existing build options
  }
})
```

---

## Step 3 — Update `index.html`

Find where `window.__BOOTSTRAP__` is currently injected (either a `<script>` tag or a server comment). Replace it with exactly this comment:

```html
<!-- SERVER_BOOTSTRAP_INJECTION_POINT: Server replaces this comment with window.__BOOTSTRAP__ script -->
```

If there is no existing injection point, add it just before `</body>`.

---

## Step 4 — Copy `LazyAuth.jsx`

Copy `C:\Users\charl\OneDrive\Documents\repos\napp-template\src\LazyAuth.jsx` into `src/LazyAuth.jsx`. Do not modify it.

---

## Step 5 — Copy `public/auth.js`

Copy `C:\Users\charl\OneDrive\Documents\repos\seemynft-auth\dist\auth.js` into `public/auth.js`.

Add to `.gitignore`:
```
# Auth bundle — built artifact, copy from ../seemynft-auth/dist/auth.js
public/auth.js
```

---

## Step 6 — Replace existing auth/login/logout code

Find all existing login, logout, and switch-accounts logic in the codebase. Replace it entirely with the pattern below. Do not leave old auth code alongside the new code.

Add these handlers wherever the auth buttons live:

```js
import { mountAuth, mountLogout, mountSwitchAccounts } from './LazyAuth'

function mountInBody() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const onClose = () => { try { document.body.removeChild(container) } catch (_) {} }
  return { container, onClose }
}

async function handleLogin() {
  const { container, onClose } = mountInBody()
  await mountAuth(container, {
    onSuccess: async () => {
      if (import.meta.env.DEV) {
        await fetch('/__dev/refresh-bootstrap', { method: 'POST' }).catch(() => {})
      }
      window.location.reload()
    },
    onClose,
  })
}

async function handleLogout() {
  const { container, onClose } = mountInBody()
  await mountLogout(container, { onSuccess: () => window.location.reload(), onClose })
}

async function handleSwitch() {
  const { container, onClose } = mountInBody()
  await mountSwitchAccounts(container, {
    onBeforeReload: import.meta.env.DEV
      ? async (walletGUID) => {
          const url = walletGUID
            ? `/__dev/refresh-bootstrap?walletGuid=${walletGUID}`
            : '/__dev/refresh-bootstrap'
          await fetch(url, { method: 'POST' }).catch(() => {})
        }
      : undefined,
    onClose,
  })
}
```

Read auth state from `window.__BOOTSTRAP__`:

```js
const b = window.__BOOTSTRAP__ || {}
const isAuthed = b.IS_AUTHORIZED_USER === true || b.IS_AUTHORIZED_USER === 'true'
const walletName = b.WALLET_LOGGED_INTO_USER_NAME || b.WALLET_NAME_USER || ''
```

Render buttons:

```jsx
{isAuthed ? (
  <>
    {walletName && (
      <span className="text-xs font-mono px-3 py-1.5 rounded-lg"
        style={{ background: '#0f0f1a', border: '1px solid #1e1e30' }}>
        {walletName}
      </span>
    )}
    <button onClick={handleSwitch}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white"
      style={{ background: '#1a1a28', border: '1px solid #2a2a3a' }}>
      Switch
    </button>
    <button onClick={handleLogout}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300"
      style={{ background: '#ff000010', border: '1px solid #ff000030' }}>
      Logout
    </button>
  </>
) : (
  <button onClick={handleLogin}
    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white"
    style={{ background: '#6366f120', border: '1px solid #6366f140' }}>
    Login
  </button>
)}
```

---

## Step 7 — Start the dev server

```bash
npm run dev
```

If not already logged in, navigate to `/__dev/login`.

---

## What to verify

- `window.__BOOTSTRAP__` is populated on page load (check DevTools console: `window.__BOOTSTRAP__`)
- Login modal appears and after login the page reloads with `isAuthed = true`
- Switch accounts shows other wallets, switching works both ways without showing "No Other Accounts"
- Logout clears the session and shows the Login button
