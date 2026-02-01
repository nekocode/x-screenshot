// =============================================================================
// Popup - Extension popup UI (Tailwind + DaisyUI)
// =============================================================================

import './style.css'

const STORAGE_KEY = 'x-screenshot-custom-css'
const STORAGE_KEY_FORMAT_TIME = 'x-screenshot-format-time'

const DEFAULT_CSS = `/* Hide some buttons */
button[aria-label="Grok actions"] {
  display: none !important;
}
button[aria-label="More"] {
  display: none !important;
}
/* Avatar styling */
div[data-testid^="UserAvatar-Container"] {
  border: 1px solid #e5e7eb !important;
  border-radius: 50% !important;
}
/* Tweet card styling */
article[data-testid="tweet"] {
  border: 1px solid #e5e7eb !important;
  border-radius: 8px !important;
  padding: 4px 16px !important;
}
`

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="w-90 p-5 bg-base-100">
    <h1 class="text-xl font-bold mb-2">X Screenshot</h1>

    <div class="mb-4">
      <label class="label" for="customCss">
        <span class="label-text text-xs">Custom CSS (applied during capture)</span>
      </label>
      <textarea
        id="customCss"
        class="textarea textarea-bordered w-full h-30 font-mono text-xs leading-relaxed mt-1"
        placeholder="/* Add custom CSS rules here */"
        spellcheck="false"
      ></textarea>
    </div>

    <div class="form-control mb-4">
      <label class="label cursor-pointer justify-start gap-3">
        <input type="checkbox" id="formatTime" class="checkbox checkbox-sm" checked />
        <span class="label-text text-sm">Format time as yyyy/MM/dd HH:mm</span>
      </label>
    </div>

    <button id="startBtn" class="btn btn-neutral w-full">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
        <circle cx="12" cy="13" r="3" fill="currentColor"/>
        <path fill="currentColor" d="M20 4h-3.17l-1.24-1.35A2 2 0 0 0 14.12 2H9.88c-.56 0-1.1.24-1.47.65L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m-8 13a5 5 0 1 1 0-10a5 5 0 0 1 0 10"/>
      </svg>
      Start Selection
    </button>
    <p id="status" class="text-center text-sm mt-3 text-base-content/60"></p>
  </div>
`

const startBtn = document.querySelector<HTMLButtonElement>('#startBtn')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const customCssInput = document.querySelector<HTMLTextAreaElement>('#customCss')!
const formatTimeCheckbox = document.querySelector<HTMLInputElement>('#formatTime')!

async function loadSavedSettings(): Promise<void> {
  const result = await browser.storage.local.get([STORAGE_KEY, STORAGE_KEY_FORMAT_TIME])
  if (result[STORAGE_KEY] !== undefined) {
    customCssInput.value = result[STORAGE_KEY] as string
  } else {
    customCssInput.value = DEFAULT_CSS
  }
  // Default to true if not set
  formatTimeCheckbox.checked = result[STORAGE_KEY_FORMAT_TIME] !== false
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null
customCssInput.addEventListener('input', () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    browser.storage.local.set({ [STORAGE_KEY]: customCssInput.value })
  }, 300)
})

formatTimeCheckbox.addEventListener('change', () => {
  browser.storage.local.set({ [STORAGE_KEY_FORMAT_TIME]: formatTimeCheckbox.checked })
})

startBtn.addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

  if (!tab.id) {
    status.textContent = 'No active tab'
    return
  }

  if (!tab.url?.includes('x.com') && !tab.url?.includes('twitter.com')) {
    status.textContent = 'Please open X (Twitter) first'
    status.classList.add('text-error')
    return
  }

  await browser.storage.local.set({
    [STORAGE_KEY]: customCssInput.value,
    [STORAGE_KEY_FORMAT_TIME]: formatTimeCheckbox.checked,
  })

  try {
    const response = await browser.tabs.sendMessage(tab.id, {
      action: 'startSelection',
      customCss: customCssInput.value,
      formatTime: formatTimeCheckbox.checked,
    })

    if (response.action === 'started') {
      status.textContent = 'Selection mode active. Click tweets to select.'
      status.classList.remove('text-error')
      window.close()
    } else if (response.action === 'cancelled') {
      status.textContent = 'Selection cancelled'
      status.classList.remove('text-error')
    }
  } catch (error) {
    status.textContent = 'Failed to start. Refresh the page and try again.'
    status.classList.add('text-error')
  }
})

loadSavedSettings()
