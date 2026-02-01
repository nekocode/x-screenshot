import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  manifest: {
    name: 'X Screenshot - Tweet Capture & Save',
    description: 'Screenshot tweets & threads from X (Twitter). Multi-select, custom CSS, download or copy to clipboard.',
    permissions: ['activeTab', 'tabs', 'storage'],
    host_permissions: ['*://x.com/*', '*://twitter.com/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
