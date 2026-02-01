// =============================================================================
// Selector Tests
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  enterSelectMode,
  exitSelectMode,
  isSelectModeActive,
  pauseSelectMode,
  resumeSelectMode,
} from '../lib/selector'

// Mock capture module
vi.mock('../lib/capture', () => ({
  captureSingleElement: vi.fn().mockResolvedValue('data:image/png;base64,mockCapture'),
  stitchImages: vi.fn().mockResolvedValue('data:image/png;base64,mockStitched'),
}))

function createMockTweetArticle(): HTMLElement {
  const article = document.createElement('article')
  article.setAttribute('data-testid', 'tweet')
  article.innerHTML = '<div>Tweet content</div>'
  // Mock getBoundingClientRect for capture validation
  vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, width: 400, height: 300,
    top: 0, left: 0, right: 400, bottom: 300,
    toJSON: () => ({})
  })
  document.body.appendChild(article)
  return article
}

async function simulateMouseEvent(
  element: Element,
  type: 'mouseover' | 'mouseout' | 'click'
): Promise<void> {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
  })
  element.dispatchEvent(event)
  // Wait for async click handler
  if (type === 'click') {
    await new Promise(r => setTimeout(r, 10))
  }
}

function hasHoverStyle(el: HTMLElement): boolean {
  return el.style.outline.includes('dashed') && el.style.outline.includes('#3b82f6')
}

function hasSelectedStyle(el: HTMLElement): boolean {
  return el.style.outline.includes('dashed') && el.style.outline.includes('#22c55e')
}

function hasOverlay(el: HTMLElement): boolean {
  return el.querySelector('.x-screenshot-overlay') !== null
}

function hasDoneButton(el: HTMLElement): boolean {
  return el.querySelector('.x-screenshot-complete-btn') !== null
}

describe('selector', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    if (isSelectModeActive()) {
      exitSelectMode()
    }
  })

  afterEach(() => {
    if (isSelectModeActive()) {
      exitSelectMode()
    }
    document.body.innerHTML = ''
  })

  describe('enterSelectMode', () => {
    it('activates select mode', () => {
      const callback = vi.fn()
      enterSelectMode(callback)

      expect(isSelectModeActive()).toBe(true)
    })

    it('injects styles', () => {
      enterSelectMode(vi.fn())

      const style = document.getElementById('x-screenshot-selector-styles')
      expect(style).not.toBeNull()
    })

    it('does nothing if already active', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      enterSelectMode(callback1)
      enterSelectMode(callback2)

      expect(isSelectModeActive()).toBe(true)
    })
  })

  describe('exitSelectMode', () => {
    it('deactivates select mode', () => {
      enterSelectMode(vi.fn())
      exitSelectMode()

      expect(isSelectModeActive()).toBe(false)
    })

    it('removes styles', () => {
      enterSelectMode(vi.fn())
      exitSelectMode()

      const style = document.getElementById('x-screenshot-selector-styles')
      expect(style).toBeNull()
    })

    it('clears selected elements', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')
      expect(hasOverlay(article)).toBe(true)

      exitSelectMode()
      expect(hasOverlay(article)).toBe(false)
    })

    it('does nothing if not active', () => {
      expect(() => exitSelectMode()).not.toThrow()
    })
  })

  describe('hover behavior', () => {
    it('adds hover class on mouseover', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'mouseover')

      expect(hasHoverStyle(article)).toBe(true)
    })

    it('removes hover class on mouseout', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'mouseover')
      await simulateMouseEvent(article, 'mouseout')

      expect(hasHoverStyle(article)).toBe(false)
    })

    it('does not show hover on selected elements', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')
      expect(hasOverlay(article)).toBe(true)

      await simulateMouseEvent(article, 'mouseover')
      expect(hasHoverStyle(article)).toBe(false)
      expect(hasSelectedStyle(article)).toBe(true)
    })
  })

  describe('click behavior', () => {
    it('selects element on click', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')

      expect(hasOverlay(article)).toBe(true)
    })

    it('deselects element on second click', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')
      await simulateMouseEvent(article, 'click')

      expect(hasOverlay(article)).toBe(false)
    })

    it('supports multi-select', async () => {
      const article1 = createMockTweetArticle()
      const article2 = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article1, 'click')
      await simulateMouseEvent(article2, 'click')

      expect(hasOverlay(article1)).toBe(true)
      expect(hasOverlay(article2)).toBe(true)
    })

    it('shows complete button on last selected', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')

      expect(hasDoneButton(article)).toBe(true)
    })

    it('moves button to last selected when multi-select', async () => {
      const article1 = createMockTweetArticle()
      const article2 = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article1, 'click')
      expect(hasDoneButton(article1)).toBe(true)

      await simulateMouseEvent(article2, 'click')
      expect(hasDoneButton(article1)).toBe(false)
      expect(hasDoneButton(article2)).toBe(true)
    })
  })

  describe('complete button', () => {
    it('calls callback with stitched image when clicked', async () => {
      const callback = vi.fn()
      const article1 = createMockTweetArticle()
      const article2 = createMockTweetArticle()

      enterSelectMode(callback)
      await simulateMouseEvent(article1, 'click')
      await simulateMouseEvent(article2, 'click')

      const button = document.querySelector('.x-screenshot-complete-btn') as HTMLButtonElement
      button.click()

      // Wait for async stitch operation
      await new Promise(r => setTimeout(r, 50))

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('data:image/png;base64,mockStitched')
    })

    it('exits select mode after completion', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')

      const button = document.querySelector('.x-screenshot-complete-btn') as HTMLButtonElement
      button.click()

      // Wait for async operations
      await new Promise(r => setTimeout(r, 50))

      expect(isSelectModeActive()).toBe(false)
    })
  })

  describe('isSelectModeActive', () => {
    it('returns false initially', () => {
      expect(isSelectModeActive()).toBe(false)
    })

    it('returns true when active', () => {
      enterSelectMode(vi.fn())
      expect(isSelectModeActive()).toBe(true)
    })

    it('returns false after exit', () => {
      enterSelectMode(vi.fn())
      exitSelectMode()
      expect(isSelectModeActive()).toBe(false)
    })
  })

  describe('pauseSelectMode', () => {
    it('does nothing when not active', () => {
      expect(() => pauseSelectMode()).not.toThrow()
    })

    it('pauses hover interactions', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      pauseSelectMode()

      // Hover should not apply styles when paused
      await simulateMouseEvent(article, 'mouseover')
      expect(hasHoverStyle(article)).toBe(false)
    })

    it('clears existing hover when paused', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'mouseover')
      expect(hasHoverStyle(article)).toBe(true)

      pauseSelectMode()
      expect(hasHoverStyle(article)).toBe(false)
    })

    it('does not clear selected elements when paused', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')
      expect(hasSelectedStyle(article)).toBe(true)

      pauseSelectMode()
      expect(hasSelectedStyle(article)).toBe(true)
    })
  })

  describe('resumeSelectMode', () => {
    it('does nothing when not active', () => {
      expect(() => resumeSelectMode()).not.toThrow()
    })

    it('resumes hover interactions after pause', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      pauseSelectMode()
      resumeSelectMode()

      await simulateMouseEvent(article, 'mouseover')
      expect(hasHoverStyle(article)).toBe(true)
    })
  })

  describe('cancel button', () => {
    it('exits select mode when clicked', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')

      const cancelBtn = document.querySelector('.x-screenshot-cancel-btn') as HTMLButtonElement
      cancelBtn.click()

      await new Promise(r => setTimeout(r, 10))

      expect(isSelectModeActive()).toBe(false)
    })

    it('clears all overlays when clicked', async () => {
      const article = createMockTweetArticle()
      enterSelectMode(vi.fn())

      await simulateMouseEvent(article, 'click')
      expect(hasOverlay(article)).toBe(true)

      const cancelBtn = document.querySelector('.x-screenshot-cancel-btn') as HTMLButtonElement
      cancelBtn.click()

      await new Promise(r => setTimeout(r, 10))

      expect(hasOverlay(article)).toBe(false)
    })
  })
})
