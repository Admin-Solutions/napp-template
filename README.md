# napp-template

Starter template for building NAPPs (NFT Application Pages) on the Admin Solutions platform. Clone this to spin up a new NAPP with authentication, session management, and the Nexus design system ready to go.

## What's included

- **React 19 + Vite 6** — fast dev server with HMR
- **Tailwind CSS v4** — utility-first styles with the Nexus dark theme
- **Lucide React** — icon library
- **seemynft-auth lazy load** — login, logout, and switch-accounts modals loaded on demand
- **LoginGate** — auth guard that blocks the app until the user is authenticated
- **seemynft-dev-proxy** — shared Vite plugin that handles dev bootstrap, cookie proxying, and auth dev endpoints

## Quick start

```bash
git clone https://github.com/Admin-Solutions/napp-template.git my-napp
cd my-napp
npm install
cp .env.development .env.development.local
# Edit .env.development.local and set VITE_TOKEN_GUID to your token GUID
npm run dev
```

If you are not already logged in, navigate to `/__dev/login` in the browser.

## Shared dev infrastructure

This project uses two shared packages from sibling repos.

### 1. seemynft-dev-proxy

Install:

```bash
npm install github:Admin-Solutions/seemynft-dev-proxy --save-dev
# or use the local sibling repo during development:
npm install "file:../seemynft-dev-proxy" --save-dev
```

In `vite.config.js`, the plugin is wired up like this:

```js
import { defineConfig, loadEnv } from 'vite'
import { seemynftDevProxy } from 'seemynft-dev-proxy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [
      // ...your other plugins (tailwindcss, react, etc.)
      mode === 'development' && seemynftDevProxy({
        guid: env.VITE_TOKEN_GUID,   // or VITE_WALLET_GUID — whatever env var holds the GUID
        type: 'token',               // 'token' (mytoken/{guid}) or 'wallet' (/{guid})
      }),
    ].filter(Boolean),
    server: {
      port: 5173,
      open: env.VITE_TOKEN_GUID ? `/mytoken/${env.VITE_TOKEN_GUID}` : true,
    },
  }
})
```

What it provides automatically (dev only, no-op in prod builds):

- Proxies `/api/*` → `https://seemynft.page/api/*` with session cookies forwarded
- Fetches `window.__BOOTSTRAP__` from the production page and injects it into `index.html`
- Refreshes `pmc_cookie` whenever `WalletAuthCookie` changes (fixes account switching)
- Dev endpoints: `/__dev/login`, `/__dev/refresh-bootstrap`, `/__dev/linked-accounts`

`index.html` must have this comment where the bootstrap should be injected:

```html
<!-- SERVER_BOOTSTRAP_INJECTION_POINT: Server replaces this comment with window.__BOOTSTRAP__ script -->
```

### 2. Auth bundle — `src/LazyAuth.jsx`

`LazyAuth.jsx` is copied directly into the repo. Do not modify the CDN URL pattern — the `Math.random()` slug is intentional cache-busting.

In dev, `auth.js` is served from `/public/auth.js` (the built IIFE bundle from the `seemynft-auth` repo). Copy it once before running the dev server:

```bash
cp ../seemynft-auth/dist/auth.js public/auth.js
```

`public/auth.js` is gitignored — it's a build artifact. In production the bundle loads from the CDN.

Three mount functions are available:

```js
import { mountAuth, mountLogout, mountSwitchAccounts } from './LazyAuth'

// Show login modal
await mountAuth(containerEl, { onSuccess: () => window.location.reload() })

// Show logout confirmation
await mountLogout(containerEl, { onSuccess: () => window.location.reload() })

// Show switch-accounts modal (refresh bootstrap before reload in dev)
await mountSwitchAccounts(el, {
  onBeforeReload: import.meta.env.DEV
    ? async (walletGUID) => {
        const url = walletGUID
          ? `/__dev/refresh-bootstrap?walletGuid=${walletGUID}`
          : '/__dev/refresh-bootstrap'
        await fetch(url, { method: 'POST' }).catch(() => {})
      }
    : undefined,
  onClose: () => { /* unmount */ },
})
```

## Auth UI

Read auth state from `window.__BOOTSTRAP__`:

```js
const b = window.__BOOTSTRAP__ || {}
const isAuthed = b.IS_AUTHORIZED_USER === true || b.IS_AUTHORIZED_USER === 'true'
const walletName = b.WALLET_LOGGED_INTO_USER_NAME || b.WALLET_NAME_USER || ''
```

Wire up handlers (see `src/App.jsx` for full working example with icons):

```js
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

Render login or logout/switch buttons based on auth state:

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

## Project structure

```
src/
├── index.css       # Nexus dark theme + CSS custom properties
├── main.jsx        # Entry point — wraps App in LoginGate
├── App.jsx         # Blank app shell with header (logout / switch accounts)
├── LazyAuth.jsx    # Lazy-loads the seemynft-auth bundle on demand
└── LoginGate.jsx   # Auth guard — shows login modal until authenticated
```

## Environment variables

Copy `.env.development` to `.env.development.local` (gitignored) and fill in:

| Variable | Required | Description |
|---|---|---|
| `VITE_TOKEN_GUID` | Yes | The `seemynft.page/mytoken/{guid}` GUID to develop against |
| `VITE_API_URL` | No | Defaults to `https://seemynft.page` |
| `VITE_UNI_API_URL` | No | Defaults to `https://seemynft.page` |

## Color scheme

All colors are driven by CSS custom properties in `src/index.css`. Change the values in `:root` to retheme the entire app:

```css
:root {
  /* Background scale */
  --nexus-900: 10 10 15;   /* darkest */
  --nexus-800: 18 18 26;
  --nexus-700: 26 26 36;
  --nexus-600: 36 36 48;
  --nexus-500: 46 46 61;   /* lightest */

  /* Accent color (indigo by default) */
  --accent:       99 102 241;
  --accent-light: 129 140 248;
  --accent-dark:  79 70 229;
}
```

Example themes:

| Theme | `--accent` | `--accent-light` | `--accent-dark` |
|---|---|---|---|
| Indigo (default) | `99 102 241` | `129 140 248` | `79 70 229` |
| Purple | `168 85 247` | `192 132 252` | `147 51 234` |
| Emerald | `16 185 129` | `52 211 153` | `5 150 105` |
| Rose | `244 63 94` | `251 113 133` | `225 29 72` |

## Building for production

```bash
npm run build
```

Output goes to `dist/`. In production the server injects `window.__BOOTSTRAP__` at the `<!-- SERVER_BOOTSTRAP_INJECTION_POINT -->` comment in `index.html`.
