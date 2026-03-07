# napp-template

Starter template for building NAPPs (NFT Application Pages) on the Admin Solutions platform. Clone this to spin up a new NAPP with authentication, session management, and the Nexus design system ready to go.

## What's included

- **React 19 + Vite 6** — fast dev server with HMR
- **Tailwind CSS v4** — utility-first styles with the Nexus dark theme
- **Lucide React** — icon library
- **seemynft-auth lazy load** — login, logout, and switch-accounts modals loaded on demand
- **LoginGate** — auth guard that blocks the app until the user is authenticated
- **Dev bootstrap proxy** — auto-fetches `window.__BOOTSTRAP__` (PMC, JWT, wallet info) from production so you never copy credentials manually
- **Cookie proxy** — forwards session cookies to `/api` requests so the dev server behaves like production
- **`/__dev/login`** — built-in login page for the dev server

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

## Auth

Authentication is handled by the `seemynft-auth` bundle, lazy-loaded from `image.admin.solutions`. A random cache-busting slug is embedded in the URL so each page load fetches a fresh bundle.

Three mount functions are available from `LazyAuth.jsx`:

```js
import { mountAuth, mountLogout, mountSwitchAccounts } from './LazyAuth'

// Show login modal
await mountAuth(containerEl, { onSuccess: () => window.location.reload() })

// Show logout confirmation
await mountLogout(containerEl, { onSuccess: () => window.location.reload() })

// Show switch-accounts modal
await mountSwitchAccounts(containerEl)
```

`LoginGate` wraps the entire app and prevents rendering until `window.__BOOTSTRAP__.USER_ACCESS_TOKEN` is present.

## Dev proxy

All `/api` requests are proxied to `https://seemynft.page`. Session cookies are captured from the proxy and forwarded automatically, so authenticated API calls work out of the box.

After logging in via `/__dev/login`, the bootstrap cache is refreshed so `window.__BOOTSTRAP__` reflects the authenticated session without a full rebuild.

## Building for production

```bash
npm run build
```

Output goes to `dist/`. In production the server injects `window.__BOOTSTRAP__` at the `<!-- SERVER_BOOTSTRAP_INJECTION_POINT -->` comment in `index.html`.
