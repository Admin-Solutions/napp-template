/**
 * LazyAuth — copy this file into any napp/wallet that needs the auth modal.
 *
 * Usage:
 *   import { mountAuth, mountLogout, mountSwitchAccounts } from './LazyAuth'
 *
 *   await mountAuth(containerEl, { onSuccess: () => location.reload() })
 *   await mountLogout(containerEl, { onSuccess: () => location.reload() })
 *   await mountSwitchAccounts(containerEl, { onBeforeReload: async () => { ... } })
 */

const AUTH_BUNDLE_URL = import.meta.env.DEV
  ? '/auth.js'
  : `https://image.admin.solutions/seemynft-auth-package-as-java-script-file-${Math.random().toString(36).slice(2)}/58854df7-05b1-401d-a35e-4b7f1e407fc2/1e6d512e-f4ed-49dd-8715-3f1514a40491/003ea398-d606-4400-9308-ed142dcd5149`

let scriptLoaded = false
let scriptLoading = false
let loadPromise = null

export function loadAuthBundle() {
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoading && loadPromise) return loadPromise

  scriptLoading = true
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = AUTH_BUNDLE_URL
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      scriptLoading = false
      if (!window.SeeMyNFTAuth) {
        loadPromise = null
        reject(new Error('SeeMyNFTAuth not found after loading bundle'))
      } else {
        scriptLoaded = true
        resolve()
      }
    }
    script.onerror = () => {
      scriptLoading = false
      loadPromise = null
      reject(new Error('Failed to load auth bundle'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

export async function mountAuth(container, options = {}) {
  await loadAuthBundle()
  return window.SeeMyNFTAuth.mount(container, {
    onSuccess: options.onSuccess ?? (() => window.location.reload()),
    onClose: options.onClose,
  })
}

export async function mountLogout(container, options = {}) {
  await loadAuthBundle()
  return window.SeeMyNFTAuth.mountLogout(container, {
    onSuccess: options.onSuccess ?? (() => window.location.reload()),
    onClose: options.onClose,
  })
}

export async function mountSwitchAccounts(container, options = {}) {
  await loadAuthBundle()
  return window.SeeMyNFTAuth.mountSwitchAccounts(container, {
    onBeforeReload: options.onBeforeReload,
    onClose: options.onClose,
  })
}
