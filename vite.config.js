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
        guid: env.VITE_TOKEN_GUID,
        type: 'token',
      }),
    ].filter(Boolean),
    server: {
      port: 5173,
      open: env.VITE_TOKEN_GUID ? `/mytoken/${env.VITE_TOKEN_GUID}` : true,
    },
  }
})
