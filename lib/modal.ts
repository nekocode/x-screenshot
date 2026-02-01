// =============================================================================
// Result Modal - Display generated image with download/copy options (Light Theme)
// =============================================================================

import { downloadImage, copyImageToClipboard } from './capture'

let modalContainer: HTMLElement | null = null

// DaisyUI light theme colors (oklch converted to rgb for inline CSS)
const MODAL_STYLES = `
  .x-screenshot-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 20px;
  }
  .x-screenshot-modal {
    background: #ffffff;
    border-radius: 16px;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  .x-screenshot-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
  }
  .x-screenshot-modal-title {
    font-size: 20px;
    font-weight: 700;
    color: #1f2937;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .x-screenshot-modal-close {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }
  .x-screenshot-modal-close:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
  .x-screenshot-modal-body {
    padding: 16px;
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;
    background: #f9fafb;
  }
  .x-screenshot-modal-body img {
    display: block;
    margin: 0 auto;
    flex-shrink: 0;
    max-width: 512px;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .x-screenshot-modal-footer {
    display: flex;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid #e5e7eb;
    justify-content: flex-end;
  }
  .x-screenshot-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: all 0.2s;
  }
  .x-screenshot-btn-primary {
    background: #1f2937;
    color: #ffffff;
    border: none;
  }
  .x-screenshot-btn-primary:hover {
    background: #374151;
  }
  .x-screenshot-btn-secondary {
    background: #ffffff;
    color: #1f2937;
    border: 1px solid #d1d5db;
  }
  .x-screenshot-btn-secondary:hover {
    background: #f3f4f6;
  }
`

export function showModal(imageDataUrl: string): void {
  closeModal()

  modalContainer = document.createElement('div')
  modalContainer.innerHTML = `
    <style>${MODAL_STYLES}</style>
    <div class="x-screenshot-modal-overlay">
      <div class="x-screenshot-modal">
        <div class="x-screenshot-modal-header">
          <span class="x-screenshot-modal-title">Screenshot</span>
          <button class="x-screenshot-modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path>
            </svg>
          </button>
        </div>
        <div class="x-screenshot-modal-body">
          <img src="${imageDataUrl}" alt="Tweet screenshot" />
        </div>
        <div class="x-screenshot-modal-footer">
          <button class="x-screenshot-btn x-screenshot-btn-secondary" data-action="copy">
            Copy to Clipboard
          </button>
          <button class="x-screenshot-btn x-screenshot-btn-primary" data-action="download">
            Download
          </button>
        </div>
      </div>
    </div>
  `

  const overlay = modalContainer.querySelector('.x-screenshot-modal-overlay')!
  const closeBtn = modalContainer.querySelector('.x-screenshot-modal-close')!
  const copyBtn = modalContainer.querySelector('[data-action="copy"]')!
  const downloadBtn = modalContainer.querySelector('[data-action="download"]')!

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal()
  })

  closeBtn.addEventListener('click', closeModal)

  copyBtn.addEventListener('click', async () => {
    try {
      await copyImageToClipboard(imageDataUrl)
      copyBtn.textContent = 'Copied!'
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard'
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      copyBtn.textContent = 'Copy Failed'
    }
  })

  downloadBtn.addEventListener('click', () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    downloadImage(imageDataUrl, `tweet-${timestamp}.png`)
  })

  document.addEventListener('keydown', handleEscKey)
  document.body.appendChild(modalContainer)
}

function handleEscKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeModal()
}

export function closeModal(): void {
  document.removeEventListener('keydown', handleEscKey)
  modalContainer?.remove()
  modalContainer = null
}
