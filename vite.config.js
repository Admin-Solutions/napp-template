import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── Shared cookie file ──────────────────────────────────────────
// nexus-ui writes authenticated cookies here after login.
// This project reads them so both dev servers share the same session.
const SHARED_COOKIE_FILE = join(tmpdir(), 'seemynft-dev-cookies.json')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  // ── Dev Bootstrap ───────────────────────────────────────────────
  // On dev server startup, fetch the production token page to:
  //   1. Extract window.__BOOTSTRAP__ → inject into local index.html
  //   2. Capture HTTP-only cookies → forward with proxied /api requests
  // This eliminates manual PMC/JWT copying. Just set VITE_TOKEN_GUID.
  // Cookie jar is a Map keyed by cookie name so login responses can
  // update individual cookies without losing the rest of the session.
  const cookieJar = new Map()
  const bootstrapCache = new Map() // tokenGuid (uppercase) → bootstrap JS literal
  const GUID_RE = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

  /** Load cookies from the shared file written by nexus-ui */
  function loadSharedCookies() {
    try {
      const data = JSON.parse(readFileSync(SHARED_COOKIE_FILE, 'utf-8'))
      let loaded = 0
      for (const [name, nv] of Object.entries(data)) {
        if (!cookieJar.has(name)) loaded++
        cookieJar.set(name, nv)
      }
      if (loaded > 0) {
        console.log(`  [shared-cookies] Loaded ${loaded} new cookie(s) from nexus-ui`)
      }
    } catch { /* file doesn't exist yet — that's fine */ }
  }

  /** Rebuild the Cookie header string from all cookies in the jar. */
  function getCookieHeader() {
    loadSharedCookies()
    return Array.from(cookieJar.values()).join('; ')
  }

  /** Parse Set-Cookie headers and merge into the jar. */
  function mergeSetCookies(setCookies) {
    if (!setCookies) return
    const list = Array.isArray(setCookies) ? setCookies : [setCookies]
    for (const raw of list) {
      const nameValue = raw.split(';')[0]
      const eqIdx = nameValue.indexOf('=')
      if (eqIdx > 0) {
        const name = nameValue.substring(0, eqIdx).trim()
        const value = nameValue.substring(eqIdx + 1)
        const lower = raw.toLowerCase()
        const isExpired = /max-age\s*=\s*0/.test(lower) ||
          /expires\s*=\s*thu,\s*01[- ]jan[- ]1970/.test(lower) ||
          value === ''
        if (isExpired) {
          cookieJar.delete(name)
        } else {
          cookieJar.set(name, nameValue)
        }
      }
    }
  }

  // Extract the __BOOTSTRAP__ object literal from raw HTML.
  function extractBootstrap(html) {
    const idx = html.indexOf('window.__BOOTSTRAP__')
    if (idx === -1) return null
    const braceStart = html.indexOf('{', idx)
    if (braceStart === -1) return null
    let depth = 0
    for (let i = braceStart; i < html.length; i++) {
      if (html[i] === '{') depth++
      else if (html[i] === '}') {
        depth--
        if (depth === 0) {
          let raw = html.substring(braceStart, i + 1)
          raw = raw.replace(/stringToBoolean\(\s*"True"\s*\)/gi, 'true')
          raw = raw.replace(/stringToBoolean\(\s*"False"\s*\)/gi, 'false')
          return raw
        }
      }
    }
    return null
  }

  /** Fetch production page for a token, extract bootstrap + cookies, cache it */
  async function fetchBootstrap(guid, label = '') {
    const upper = guid.toUpperCase()
    const pageUrl = `https://seemynft.page/mytoken/${guid}`
    const tag = label ? ` (${label})` : ''
    console.log(`\n  [dev-bootstrap] Fetching ${pageUrl}${tag} ...`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        ...(cookieJar.size > 0 ? { 'Cookie': getCookieHeader() } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`  [dev-bootstrap] HTTP ${res.status}`)
      return null
    }

    mergeSetCookies(res.headers.getSetCookie?.() || [])

    const html = await res.text()
    const bootstrap = extractBootstrap(html)

    if (bootstrap) {
      bootstrapCache.set(upper, bootstrap)
      console.log(`  [dev-bootstrap] Cached bootstrap for ${upper} (${cookieJar.size} cookies: ${Array.from(cookieJar.keys()).join(', ')})`)
    } else {
      console.warn('  [dev-bootstrap] No __BOOTSTRAP__ found in HTML')
    }
    return bootstrap
  }

  return {
    plugins: [
      tailwindcss(),
      react(),

      // Dev-only plugin: auto-fetch production bootstrap + cookies
      mode === 'development' && env.VITE_TOKEN_GUID && {
        name: 'dev-bootstrap',

        async configureServer(server) {
          const defaultGuid = env.VITE_TOKEN_GUID.toUpperCase()

          loadSharedCookies()

          try {
            await fetchBootstrap(defaultGuid)
          } catch (err) {
            const msg = err.name === 'AbortError' ? 'Fetch timed out (10s)' : err.message
            console.error(`  [dev-bootstrap] ${msg} — falling back to env vars\n`)
          }

          // Endpoint to re-fetch bootstrap after login
          server.middlewares.use('/__dev/refresh-bootstrap', async (req, res) => {
            try {
              bootstrapCache.clear()
              const bootstrap = await fetchBootstrap(defaultGuid, 'post-login refresh')
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: !!bootstrap }))
            } catch (err) {
              console.error(`  [dev-bootstrap] Refresh failed: ${err.message}`)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false }))
            }
          })

          // Dev login page — navigate to /__dev/login to authenticate
          server.middlewares.use('/__dev/login', (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dev Login -- seemynft.page</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f0f1a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a2e; border: 1px solid #2d2d4e; border-radius: 12px; padding: 32px; width: 100%; max-width: 400px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 14px; background: #0f0f1a; border: 1px solid #2d2d4e; border-radius: 8px; color: #e2e8f0; font-size: 14px; outline: none; }
    input:focus { border-color: #6366f1; }
    .field { margin-bottom: 16px; }
    button.primary { width: 100%; padding: 11px; background: #6366f1; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 4px; }
    button.primary:hover { background: #4f46e5; }
    button.primary:disabled { background: #3d3d6b; cursor: not-allowed; }
    button.link { color: #6366f1; cursor: pointer; font-size: 13px; margin-top: 10px; display: block; background: none; border: none; padding: 0; }
    button.link:hover { color: #818cf8; }
    .error { color: #f87171; font-size: 13px; margin-top: 10px; }
    .success { color: #4ade80; font-size: 14px; margin-top: 8px; }
    .hidden { display: none; }
  </style>
</head>
<body>
<div class="card">
  <h1>Dev Login</h1>
  <p class="sub">Log in to seemynft.page. Cookies are captured by the proxy and used for all API requests.</p>
  <div id="s-email">
    <div class="field"><label>Email</label><input id="email" type="email" placeholder="you@example.com" autofocus /></div>
    <button class="primary" id="b-email">Continue</button>
    <div id="e-email" class="error hidden"></div>
  </div>
  <div id="s-password" class="hidden">
    <div class="field"><label>Password</label><input id="password" type="password" placeholder="Enter password" /></div>
    <button class="primary" id="b-password">Log In</button>
    <button class="link" id="b-use-code">Use email code instead</button>
    <div id="e-password" class="error hidden"></div>
  </div>
  <div id="s-code" class="hidden">
    <div class="field"><label>6-digit code sent to your email</label><input id="code" type="text" maxlength="6" placeholder="000000" /></div>
    <button class="primary" id="b-code">Verify</button>
    <div id="e-code" class="error hidden"></div>
  </div>
  <div id="s-done" class="hidden"><div class="success">Logged in! Refreshing bootstrap and redirecting...</div></div>
</div>
<script>
  let codeGUID = null
  const steps = ['s-email','s-password','s-code','s-done']
  const show = id => steps.forEach(s => document.getElementById(s).classList.toggle('hidden', s !== id))
  const err = (id, msg) => { const el = document.getElementById(id); el.textContent = msg; el.classList.toggle('hidden', !msg) }
  const email = () => document.getElementById('email').value.trim()
  async function post(body) {
    const r = await fetch('/api/UniversalPassword/login', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify(body) })
    return r.json()
  }
  async function onSuccess() {
    show('s-done')
    await fetch('/__dev/refresh-bootstrap', { method: 'POST' })
    setTimeout(() => window.location.href = '/', 1500)
  }
  document.getElementById('b-email').onclick = async () => {
    if (!email()) return
    err('e-email', '')
    const btn = document.getElementById('b-email'); btn.disabled=true; btn.textContent='Checking...'
    try {
      const d = await post({ two_factor_address: email() })
      const sc = d?.statusCode ?? d?.data?.statusCode
      if (sc==1000) show('s-password')
      else if (sc==1002) { codeGUID = d?.codeCheckGUID ?? d?.data?.codeCheckGUID; show('s-code') }
      else err('e-email', d?.errorMessage ?? d?.data?.errorMessage ?? 'Email not recognized')
    } catch(e) { err('e-email', e.message) }
    btn.disabled=false; btn.textContent='Continue'
  }
  document.getElementById('b-use-code').onclick = async () => {
    const d = await post({ use_access_code: true, two_factor_address: email() })
    const sc = d?.statusCode ?? d?.data?.statusCode
    if (sc==1002) { codeGUID = d?.codeCheckGUID ?? d?.data?.codeCheckGUID; show('s-code') }
  }
  document.getElementById('b-password').onclick = async () => {
    const pw = document.getElementById('password').value.trim()
    err('e-password', '')
    const btn = document.getElementById('b-password'); btn.disabled=true; btn.textContent='Logging in...'
    try {
      const d = await post({ two_factor_address: email(), input_password: pw })
      const sc = d?.statusCode ?? d?.data?.statusCode
      if (sc==1001) await onSuccess()
      else if (sc==1002) { codeGUID = d?.codeCheckGUID ?? d?.data?.codeCheckGUID; show('s-code') }
      else err('e-password', d?.errorMessage ?? d?.data?.errorMessage ?? 'Invalid password')
    } catch(e) { err('e-password', e.message) }
    btn.disabled=false; btn.textContent='Log In'
  }
  document.getElementById('b-code').onclick = async () => {
    const c = document.getElementById('code').value.trim()
    err('e-code', '')
    const btn = document.getElementById('b-code'); btn.disabled=true; btn.textContent='Verifying...'
    try {
      const d = await post({ use_access_code: true, code_guid: codeGUID, two_factor_address: email(), input_password: c })
      const sc = d?.statusCode ?? d?.data?.statusCode
      if (sc==1001) await onSuccess()
      else err('e-code', d?.errorMessage ?? d?.data?.errorMessage ?? 'Invalid code')
    } catch(e) { err('e-code', e.message) }
    btn.disabled=false; btn.textContent='Verify'
  }
  document.getElementById('email').onkeydown = e => { if(e.key==='Enter') document.getElementById('b-email').click() }
  document.getElementById('password').onkeydown = e => { if(e.key==='Enter') document.getElementById('b-password').click() }
  document.getElementById('code').onkeydown = e => { if(e.key==='Enter') document.getElementById('b-code').click() }
</script>
</body>
</html>`)
          })
        },

        async transformIndexHtml(html, ctx) {
          const guidMatch = ctx?.originalUrl?.match(GUID_RE)
          const requestedGuid = guidMatch
            ? guidMatch[1].toUpperCase()
            : env.VITE_TOKEN_GUID.toUpperCase()

          let bootstrap = bootstrapCache.get(requestedGuid)
          if (!bootstrap) {
            try {
              bootstrap = await fetchBootstrap(requestedGuid, 'on-demand')
            } catch (err) {
              console.error(`  [dev-bootstrap] Fetch failed for ${requestedGuid}: ${err.message}`)
            }
          }

          if (!bootstrap) return html

          const script = `<script>window.__BOOTSTRAP__ = ${bootstrap};<\/script>`
          return html.replace(
            '<!-- SERVER_BOOTSTRAP_INJECTION_POINT: Server replaces this comment with window.__BOOTSTRAP__ script -->',
            script,
          )
        },
      },
    ].filter(Boolean),

    server: {
      port: 5173,
      open: env.VITE_TOKEN_GUID
        ? `/mytoken/${env.VITE_TOKEN_GUID}`
        : true,
      proxy: {
        '/api': {
          target: 'https://seemynft.page',
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const cookies = getCookieHeader()
              if (cookies) {
                proxyReq.setHeader('Cookie', cookies)
              }
              console.log(`  [dev-proxy] -> ${proxyReq.method} ${proxyReq.path} (${cookieJar.size} cookies)`)
            })
            proxy.on('proxyRes', (proxyRes) => {
              const setCookies = proxyRes.headers['set-cookie']
              if (setCookies) {
                const before = getCookieHeader()
                mergeSetCookies(setCookies)
                const after = getCookieHeader()
                if (before !== after) {
                  bootstrapCache.clear()
                  console.log(`  [dev-proxy] Cookies changed -> bootstrap cache cleared (${cookieJar.size} cookie(s))`)
                }
              }
            })
          },
        },
      },
    },

    preview: { port: 5173 },
  }
})
