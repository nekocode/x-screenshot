// =============================================================================
// Background Script - Handle captureVisibleTab requests
// =============================================================================

export default defineBackground(() => {
  console.log('[x-screenshot] Background script loaded')

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureVisibleTab') {
      // Use Chrome's captureVisibleTab API
      browser.tabs.captureVisibleTab({ format: 'png' }).then((dataUrl) => {
        sendResponse({ dataUrl })
      }).catch((err) => {
        console.error('[x-screenshot] captureVisibleTab failed:', err)
        sendResponse({ error: err.message })
      })

      // Return true to indicate async response
      return true
    }
  })
})
