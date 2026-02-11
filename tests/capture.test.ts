// =============================================================================
// Capture Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  captureElements,
  downloadImage,
  copyImageToClipboard,
  stitchImages,
  setCustomCss,
  setFormatTime,
} from '../lib/capture'

// Mock browser.runtime.sendMessage
const mockSendMessage = vi.fn().mockResolvedValue({
  dataUrl: 'data:image/png;base64,mockScreenshot'
})
vi.stubGlobal('browser', {
  runtime: {
    sendMessage: mockSendMessage
  }
})

// Mock canvas
const mockContext = {
  fillStyle: '',
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({
    data: new Uint8ClampedArray(100 * 100 * 4),
    width: 100,
    height: 100,
  }),
}
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext) as any
HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,croppedImage')

// Mock Image
class MockImage {
  width = 100
  height = 100
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''

  get src() { return this._src }
  set src(value: string) {
    this._src = value
    setTimeout(() => this.onload?.(), 0)
  }
}
global.Image = MockImage as any

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => { cb(0); return 0 }

// Helper to create element with mocked size
function createElementWithSize(width: number, height: number): HTMLDivElement {
  const element = document.createElement('div')
  document.body.appendChild(element)
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, width, height,
    top: 0, left: 0, right: width, bottom: height,
    toJSON: () => ({})
  })
  return element
}

describe('captureElements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
    window.scrollTo = vi.fn()
  })

  it('returns a data URL', async () => {
    const element = createElementWithSize(400, 300)

    const result = await captureElements([element])

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('calls sendMessage for capture', async () => {
    const element = createElementWithSize(400, 300)

    await captureElements([element])

    expect(mockSendMessage).toHaveBeenCalledWith({ action: 'captureVisibleTab' })
  })

  it('injects and removes capture styles', async () => {
    const element = createElementWithSize(400, 300)

    await captureElements([element])

    // Style should be removed after capture
    const style = document.getElementById('x-screenshot-capture-styles')
    expect(style).toBeNull()
  })

  it('handles elements taller than viewport with multiple captures', async () => {
    const element = createElementWithSize(400, 1200)

    await captureElements([element])

    // Should capture multiple times for tall element
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
  })

  it('throws error when captureVisibleTab fails', async () => {
    mockSendMessage.mockResolvedValueOnce({ error: 'Tab not found' })
    const element = createElementWithSize(400, 300)

    await expect(captureElements([element])).rejects.toThrow('captureVisibleTab failed: Tab not found')
  })

  it('throws error when dataUrl is empty', async () => {
    mockSendMessage.mockResolvedValueOnce({ dataUrl: '' })
    const element = createElementWithSize(400, 300)

    await expect(captureElements([element])).rejects.toThrow('captureVisibleTab returned empty dataUrl')
  })

  it('throws error when element has no size', async () => {
    const element = createElementWithSize(0, 0)

    await expect(captureElements([element])).rejects.toThrow('captureElement: Element has no size')
  })

  it('captures element that fits viewport after scrollIntoView', async () => {
    // Element fits in viewport and becomes fully visible after scroll
    const element = createElementWithSize(400, 500)
    vi.spyOn(element, 'scrollIntoView').mockImplementation(() => {})

    const result = await captureElements([element])

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('handles element that needs segment capture even if fits viewport', async () => {
    // Element fits viewport but scrollIntoView doesn't make it fully visible
    const element = createElementWithSize(400, 700)
    vi.spyOn(element, 'getBoundingClientRect')
      .mockReturnValueOnce({
        x: 0, y: 0, width: 400, height: 700,
        top: 0, left: 0, right: 400, bottom: 700,
        toJSON: () => ({})
      })
      // After scrollIntoView, element is partially cut off
      .mockReturnValue({
        x: 0, y: -100, width: 400, height: 700,
        top: -100, left: 0, right: 400, bottom: 600,
        toJSON: () => ({})
      })

    const result = await captureElements([element])

    expect(result).toMatch(/^data:image\/png;base64,/)
  })
})

describe('downloadImage', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    createElementSpy?.mockRestore()
  })

  it('creates download link with correct attributes', () => {
    const mockClick = vi.fn()
    const mockLink = {
      download: '',
      href: '',
      click: mockClick,
    }
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)

    downloadImage('data:image/png;base64,test', 'test.png')

    expect(mockLink.download).toBe('test.png')
    expect(mockLink.href).toBe('data:image/png;base64,test')
    expect(mockClick).toHaveBeenCalled()
  })

  it('uses default filename', () => {
    const mockLink = { download: '', href: '', click: vi.fn() }
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)

    downloadImage('data:image/png;base64,test')

    expect(mockLink.download).toBe('tweet.png')
  })
})

describe('copyImageToClipboard', () => {
  let mockWrite: ReturnType<typeof vi.fn>

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' })),
    })

    mockWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: mockWrite },
      writable: true,
      configurable: true,
    })

    global.ClipboardItem = class MockClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    } as any
  })

  it('copies image to clipboard', async () => {
    await copyImageToClipboard('data:image/png;base64,test')

    expect(fetch).toHaveBeenCalledWith('data:image/png;base64,test')
    expect(mockWrite).toHaveBeenCalled()
  })

  it('creates ClipboardItem with correct MIME type', async () => {
    await copyImageToClipboard('data:image/png;base64,test')

    expect(mockWrite).toHaveBeenCalledWith([
      expect.objectContaining({ items: expect.objectContaining({ 'image/png': expect.any(Blob) }) })
    ])
  })
})

describe('stitchImages', () => {
  const stitchContext = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-mock canvas for stitchImages tests
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(stitchContext) as any
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,stitched')
  })

  it('throws error when no images provided', async () => {
    await expect(stitchImages([])).rejects.toThrow('stitchImages: No images to stitch')
  })

  it('returns single image unchanged dimensions', async () => {
    const result = await stitchImages(['data:image/png;base64,single'])

    expect(result).toMatch(/^data:image\/png;base64,/)
    expect(stitchContext.drawImage).toHaveBeenCalled()
  })

  it('stitches multiple images vertically', async () => {
    const result = await stitchImages([
      'data:image/png;base64,first',
      'data:image/png;base64,second',
    ])

    expect(result).toMatch(/^data:image\/png;base64,/)
    // drawImage called twice for two images
    expect(stitchContext.drawImage).toHaveBeenCalledTimes(2)
  })

  it('fills background with black', async () => {
    await stitchImages(['data:image/png;base64,test'])

    expect(stitchContext.fillStyle).toBe('#000000')
    expect(stitchContext.fillRect).toHaveBeenCalled()
  })
})

describe('setCustomCss', () => {
  it('sets custom CSS without error', () => {
    expect(() => setCustomCss('.test { color: red; }')).not.toThrow()
  })

  it('accepts empty string', () => {
    expect(() => setCustomCss('')).not.toThrow()
  })
})

describe('setFormatTime', () => {
  it('enables format time without error', () => {
    expect(() => setFormatTime(true)).not.toThrow()
  })

  it('disables format time without error', () => {
    expect(() => setFormatTime(false)).not.toThrow()
  })
})

describe('loadImage error paths', () => {
  it('rejects when image source is empty', async () => {
    // Create a failing Image mock
    class FailingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private _src = ''

      get src() { return this._src }
      set src(value: string) {
        this._src = value
        // Empty src triggers reject
        if (!value) {
          setTimeout(() => this.onerror?.(), 0)
        }
      }
    }
    global.Image = FailingImage as any

    // Try to stitch with empty URL - should fail at loadImage
    await expect(stitchImages([''])).rejects.toThrow('loadImage: Empty image source')

    // Restore original mock
    global.Image = MockImage as any
  })

  it('rejects when image format is invalid', async () => {
    await expect(stitchImages(['invalid-url'])).rejects.toThrow('loadImage: Invalid data URL format')
  })

  it('rejects when image fails to decode', async () => {
    class FailingImage {
      width = 100
      height = 100
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private _src = ''

      get src() { return this._src }
      set src(value: string) {
        this._src = value
        // Trigger error for valid data URL
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    global.Image = FailingImage as any

    await expect(stitchImages(['data:image/png;base64,corrupted']))
      .rejects.toThrow('loadImage: Failed to decode image')

    // Restore original mock
    global.Image = MockImage as any
  })
})
