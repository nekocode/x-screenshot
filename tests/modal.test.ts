// =============================================================================
// Modal Tests
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { showModal, closeModal } from '../lib/modal'

// Mock capture functions
vi.mock('../lib/capture', () => ({
  downloadImage: vi.fn(),
  copyImageToClipboard: vi.fn().mockResolvedValue(undefined),
}))

describe('modal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    closeModal()
    document.body.innerHTML = ''
  })

  describe('showModal', () => {
    it('creates modal overlay', () => {
      showModal('data:image/png;base64,test')

      const overlay = document.querySelector('.x-screenshot-modal-overlay')
      expect(overlay).not.toBeNull()
    })

    it('displays the image', () => {
      const imageUrl = 'data:image/png;base64,testImage'
      showModal(imageUrl)

      const img = document.querySelector('.x-screenshot-modal-body img') as HTMLImageElement
      expect(img).not.toBeNull()
      expect(img.src).toBe(imageUrl)
    })

    it('includes title', () => {
      showModal('data:image/png;base64,test')

      const title = document.querySelector('.x-screenshot-modal-title')
      expect(title?.textContent).toBe('Screenshot')
    })

    it('includes close button', () => {
      showModal('data:image/png;base64,test')

      const closeBtn = document.querySelector('.x-screenshot-modal-close')
      expect(closeBtn).not.toBeNull()
    })

    it('includes copy and download buttons', () => {
      showModal('data:image/png;base64,test')

      const copyBtn = document.querySelector('[data-action="copy"]')
      const downloadBtn = document.querySelector('[data-action="download"]')
      expect(copyBtn).not.toBeNull()
      expect(downloadBtn).not.toBeNull()
    })

    it('closes previous modal before opening new one', () => {
      showModal('data:image/png;base64,first')
      showModal('data:image/png;base64,second')

      const overlays = document.querySelectorAll('.x-screenshot-modal-overlay')
      expect(overlays).toHaveLength(1)

      const img = document.querySelector('.x-screenshot-modal-body img') as HTMLImageElement
      expect(img.src).toBe('data:image/png;base64,second')
    })
  })

  describe('closeModal', () => {
    it('removes modal from DOM', () => {
      showModal('data:image/png;base64,test')
      closeModal()

      const overlay = document.querySelector('.x-screenshot-modal-overlay')
      expect(overlay).toBeNull()
    })

    it('does nothing if no modal exists', () => {
      expect(() => closeModal()).not.toThrow()
    })
  })

  describe('interactions', () => {
    it('closes modal when clicking overlay', () => {
      showModal('data:image/png;base64,test')

      const overlay = document.querySelector('.x-screenshot-modal-overlay') as HTMLElement
      overlay.click()

      expect(document.querySelector('.x-screenshot-modal-overlay')).toBeNull()
    })

    it('closes modal when clicking close button', () => {
      showModal('data:image/png;base64,test')

      const closeBtn = document.querySelector('.x-screenshot-modal-close') as HTMLElement
      closeBtn.click()

      expect(document.querySelector('.x-screenshot-modal-overlay')).toBeNull()
    })

    it('closes modal on Escape key', () => {
      showModal('data:image/png;base64,test')

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      expect(document.querySelector('.x-screenshot-modal-overlay')).toBeNull()
    })

    it('calls downloadImage when download button clicked', async () => {
      const { downloadImage } = await import('../lib/capture')
      showModal('data:image/png;base64,test')

      const downloadBtn = document.querySelector('[data-action="download"]') as HTMLElement
      downloadBtn.click()

      expect(downloadImage).toHaveBeenCalled()
    })

    it('calls copyImageToClipboard when copy button clicked', async () => {
      const { copyImageToClipboard } = await import('../lib/capture')
      showModal('data:image/png;base64,test')

      const copyBtn = document.querySelector('[data-action="copy"]') as HTMLElement
      copyBtn.click()

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(copyImageToClipboard).toHaveBeenCalledWith('data:image/png;base64,test')
    })

    it('does not close modal when clicking inside modal content', () => {
      showModal('data:image/png;base64,test')

      const modal = document.querySelector('.x-screenshot-modal') as HTMLElement
      modal.click()

      expect(document.querySelector('.x-screenshot-modal-overlay')).not.toBeNull()
    })
  })
})
