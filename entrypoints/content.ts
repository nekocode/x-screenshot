// =============================================================================
// Content Script - Main entry point for X page interaction
// =============================================================================

import { enterSelectMode, exitSelectMode, isSelectModeActive } from '@/lib/selector'
import { setCustomCss, setFormatTime } from '@/lib/capture'
import { showModal } from '@/lib/modal'

export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*'],

  main() {
    console.log('[x-screenshot] Content script loaded')

    // Listen for messages from popup
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'startSelection') {
        if (isSelectModeActive()) {
          exitSelectMode()
          sendResponse({ success: true, action: 'cancelled' })
        } else {
          // Set options before starting selection
          setCustomCss(message.customCss || '')
          setFormatTime(message.formatTime !== false)
          enterSelectMode(handleSelectionComplete)
          sendResponse({ success: true, action: 'started' })
        }
        return true
      }

      if (message.action === 'getStatus') {
        sendResponse({ active: isSelectModeActive() })
        return true
      }

      sendResponse({ success: false, error: 'Unknown action' })
      return true
    })
  },
})

// Now receives the already-stitched image directly from selector
function handleSelectionComplete(imageUrl: string): void {
  console.log('[x-screenshot] Selection complete, image size:', imageUrl.length)
  showModal(imageUrl)
}
