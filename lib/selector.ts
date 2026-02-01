// =============================================================================
// Selection Mode - Handle hover/click/multi-select interactions (Light Theme)
// Captures tweets immediately on selection to handle virtual list recycling
// =============================================================================

import { captureSingleElement, stitchImages } from './capture'

const TWEET_SELECTOR = 'article[data-testid="tweet"]'

const CAMERA_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
  <path fill="currentColor" fill-rule="evenodd"
    d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.408 4.408 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697c0-3.065 0-4.597-.749-5.697a4.407 4.407 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.405 4.405 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364c0 3.064 0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21M12 9.273c-2.301 0-4.167 1.831-4.167 4.09c0 2.26 1.866 4.092 4.167 4.092c2.301 0 4.167-1.832 4.167-4.091c0-2.26-1.866-4.091-4.167-4.091m0 1.636c-1.38 0-2.5 1.099-2.5 2.455c0 1.355 1.12 2.454 2.5 2.454s2.5-1.099 2.5-2.454c0-1.356-1.12-2.455-2.5-2.455m4.722-.818c0-.452.373-.818.834-.818h1.11c.46 0 .834.366.834.818a.826.826 0 0 1-.833.818h-1.111a.826.826 0 0 1-.834-.818"
    clip-rule="evenodd" />
</svg>`

interface CapturedTweet {
  overlay: HTMLElement
  dataUrl: string
}

export interface SelectionState {
  active: boolean
  selected: Map<Element, CapturedTweet>
  capturedUrls: string[]
  hovered: Element | null
  hoverOverlay: HTMLElement | null
  capturing: boolean
  paused: boolean
}

type SelectionCallback = (imageDataUrl: string) => void

let state: SelectionState = {
  active: false,
  selected: new Map(),
  capturedUrls: [],
  hovered: null,
  hoverOverlay: null,
  capturing: false,
  paused: false,
}

let onComplete: SelectionCallback | null = null
let styleElement: HTMLStyleElement | null = null

// =============================================================================
// Light theme colors
// =============================================================================

const HOVER_COLOR = '#3b82f6' // blue-500
const SELECTED_COLOR = '#22c55e' // green-500
const HOVER_BG = 'rgba(59, 130, 246, 0.5)'
const SELECTED_BG = 'rgba(34, 197, 94, 0.5)'

// =============================================================================
// Style injection
// =============================================================================

function injectStyles(): void {
  if (styleElement) return

  styleElement = document.createElement('style')
  styleElement.id = 'x-screenshot-selector-styles'
  styleElement.textContent = `
    .x-screenshot-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .x-screenshot-overlay-hover {
      background: ${HOVER_BG};
    }
    .x-screenshot-overlay-selected {
      background: ${SELECTED_BG};
    }
    .x-screenshot-camera-icon {
      color: ${HOVER_COLOR};
    }
    .x-screenshot-btn-container {
      display: flex;
      flex-direction: row;
      gap: 8px;
      pointer-events: auto;
    }
    .x-screenshot-complete-btn,
    .x-screenshot-cancel-btn {
      border: none;
      border-radius: 8px;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      transition: all 0.15s;
    }
    .x-screenshot-complete-btn {
      background: ${SELECTED_COLOR};
      color: white;
    }
    .x-screenshot-complete-btn:hover {
      background: #16a34a;
      transform: translateY(-1px);
    }
    .x-screenshot-cancel-btn {
      background: #ffffff;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    .x-screenshot-cancel-btn:hover {
      background: #f3f4f6;
      transform: translateY(-1px);
    }
  `
  document.head.appendChild(styleElement)
}

function removeStyles(): void {
  styleElement?.remove()
  styleElement = null
}

// =============================================================================
// Overlay management
// =============================================================================

function createHoverOverlay(tweet: Element): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'x-screenshot-overlay x-screenshot-overlay-hover'

  const icon = document.createElement('div')
  icon.className = 'x-screenshot-camera-icon'
  icon.innerHTML = CAMERA_ICON
  overlay.appendChild(icon)

  if (tweet instanceof HTMLElement) {
    const computed = getComputedStyle(tweet)
    if (computed.position === 'static') {
      tweet.style.position = 'relative'
    }
    tweet.appendChild(overlay)
  }

  return overlay
}

function removeHoverOverlay(): void {
  state.hoverOverlay?.remove()
  state.hoverOverlay = null
}

function createSelectedOverlay(tweet: Element, showButtons: boolean): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'x-screenshot-overlay x-screenshot-overlay-selected'

  if (showButtons) {
    const container = document.createElement('div')
    container.className = 'x-screenshot-btn-container'

    const doneBtn = document.createElement('button')
    doneBtn.className = 'x-screenshot-complete-btn'
    doneBtn.textContent = 'Done'
    doneBtn.addEventListener('click', (e) => {
      console.log('[x-screenshot] Done button clicked')
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      finishSelection()
    }, true)
    container.appendChild(doneBtn)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'x-screenshot-cancel-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', (e) => {
      console.log('[x-screenshot] Cancel button clicked')
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      exitSelectMode()
    }, true)
    container.appendChild(cancelBtn)

    overlay.appendChild(container)
  }

  if (tweet instanceof HTMLElement) {
    const computed = getComputedStyle(tweet)
    if (computed.position === 'static') {
      tweet.style.position = 'relative'
    }
    tweet.appendChild(overlay)
  }

  return overlay
}

function removeSelectedOverlay(tweet: Element): void {
  const captured = state.selected.get(tweet)
  if (captured) {
    captured.overlay.remove()
    const index = state.capturedUrls.indexOf(captured.dataUrl)
    if (index !== -1) {
      state.capturedUrls.splice(index, 1)
    }
    state.selected.delete(tweet)
    clearSelectedStyle(tweet)
  }
}

function updateSelectedOverlays(): void {
  const entries = Array.from(state.selected.entries())

  entries.forEach(([tweet, captured], index) => {
    const isLast = index === entries.length - 1
    const hasButton = captured.overlay.querySelector('.x-screenshot-complete-btn') !== null

    if (isLast && !hasButton) {
      captured.overlay.remove()
      const newOverlay = createSelectedOverlay(tweet, true)
      state.selected.set(tweet, { ...captured, overlay: newOverlay })
    } else if (!isLast && hasButton) {
      captured.overlay.remove()
      const newOverlay = createSelectedOverlay(tweet, false)
      state.selected.set(tweet, { ...captured, overlay: newOverlay })
    }
  })
}

// =============================================================================
// Inline style helpers
// =============================================================================

function setHoverStyle(el: Element): void {
  if (el instanceof HTMLElement) {
    el.style.setProperty('outline', `3px dashed ${HOVER_COLOR}`, 'important')
    el.style.setProperty('outline-offset', '-3px', 'important')
    el.style.setProperty('cursor', 'pointer', 'important')
  }
}

function clearHoverStyle(el: Element): void {
  if (el instanceof HTMLElement) {
    el.style.removeProperty('outline')
    el.style.removeProperty('outline-offset')
    el.style.removeProperty('cursor')
  }
}

function setSelectedStyle(el: Element): void {
  if (el instanceof HTMLElement) {
    el.style.setProperty('outline', `3px dashed ${SELECTED_COLOR}`, 'important')
    el.style.setProperty('outline-offset', '-3px', 'important')
  }
}

function clearSelectedStyle(el: Element): void {
  if (el instanceof HTMLElement) {
    el.style.removeProperty('outline')
    el.style.removeProperty('outline-offset')
  }
}

// =============================================================================
// Event handlers
// =============================================================================

function handleMouseOver(e: MouseEvent): void {
  if (!state.active || state.paused || state.capturing) return

  const tweet = (e.target as Element).closest(TWEET_SELECTOR)
  if (!tweet || tweet === state.hovered) return

  if (state.hovered && !state.selected.has(state.hovered)) {
    clearHoverStyle(state.hovered)
    removeHoverOverlay()
  }

  if (!state.selected.has(tweet)) {
    setHoverStyle(tweet)
    state.hoverOverlay = createHoverOverlay(tweet)
  }
  state.hovered = tweet
}

function handleMouseOut(e: MouseEvent): void {
  if (!state.active || state.paused || state.capturing) return

  const tweet = (e.target as Element).closest(TWEET_SELECTOR)
  if (tweet && tweet === state.hovered) {
    if (!state.selected.has(tweet)) {
      clearHoverStyle(tweet)
      removeHoverOverlay()
    }
    state.hovered = null
  }
}

async function handleClick(e: MouseEvent): Promise<void> {
  if (!state.active || state.capturing) return

  const target = e.target as Element

  if (target.closest('.x-screenshot-complete-btn') || target.closest('.x-screenshot-cancel-btn')) {
    return
  }

  const tweet = target.closest(TWEET_SELECTOR)
  if (!tweet) return

  e.preventDefault()
  e.stopPropagation()

  if (state.selected.has(tweet)) {
    removeSelectedOverlay(tweet)
    updateSelectedOverlays()
  } else {
    state.capturing = true
    clearHoverStyle(tweet)
    removeHoverOverlay()

    try {
      const dataUrl = await captureSingleElement(tweet)

      setSelectedStyle(tweet)
      const overlay = createSelectedOverlay(tweet, false)
      state.capturedUrls.push(dataUrl)
      state.selected.set(tweet, { overlay, dataUrl })
      updateSelectedOverlays()
    } catch (err) {
      console.error('[x-screenshot] Capture failed:', err)
    } finally {
      state.capturing = false
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

export function enterSelectMode(callback: SelectionCallback): void {
  if (state.active) return

  state = {
    active: true,
    selected: new Map(),
    capturedUrls: [],
    hovered: null,
    hoverOverlay: null,
    capturing: false,
    paused: false,
  }
  onComplete = callback

  injectStyles()
  document.addEventListener('mouseover', handleMouseOver, true)
  document.addEventListener('mouseout', handleMouseOut, true)
  document.addEventListener('click', handleClick as unknown as EventListener, true)
}

export function exitSelectMode(): void {
  if (!state.active) return

  document.removeEventListener('mouseover', handleMouseOver, true)
  document.removeEventListener('mouseout', handleMouseOut, true)
  document.removeEventListener('click', handleClick as unknown as EventListener, true)

  // Clean up ALL tweets, not just tracked ones (virtual list may have recycled elements)
  document.querySelectorAll(TWEET_SELECTOR).forEach(tweet => {
    if (tweet instanceof HTMLElement) {
      tweet.style.removeProperty('outline')
      tweet.style.removeProperty('outline-offset')
      tweet.style.removeProperty('cursor')
    }
  })

  // Remove ALL overlays (in case some were orphaned)
  document.querySelectorAll('.x-screenshot-overlay').forEach(overlay => {
    overlay.remove()
  })

  removeStyles()

  state = {
    active: false,
    selected: new Map(),
    capturedUrls: [],
    hovered: null,
    hoverOverlay: null,
    capturing: false,
    paused: false,
  }
  onComplete = null
}

export function pauseSelectMode(): void {
  if (!state.active) return
  state.paused = true
  if (state.hovered && !state.selected.has(state.hovered)) {
    clearHoverStyle(state.hovered)
    removeHoverOverlay()
  }
  state.hovered = null
}

export function resumeSelectMode(): void {
  if (!state.active) return
  state.paused = false
}

async function finishSelection(): Promise<void> {
  console.log('[x-screenshot] finishSelection called, selected:', state.selected.size)
  const capturedUrls = [...state.capturedUrls]
  const callback = onComplete

  console.log('[x-screenshot] Calling exitSelectMode...')
  exitSelectMode()
  console.log('[x-screenshot] exitSelectMode done, active:', state.active)

  if (callback && capturedUrls.length > 0) {
    console.log('[x-screenshot] Stitching', capturedUrls.length, 'images')
    try {
      const finalImage = await stitchImages(capturedUrls)
      callback(finalImage)
    } catch (err) {
      console.error('[x-screenshot] Stitch error:', err)
    }
  } else {
    console.log('[x-screenshot] No callback or no images')
  }
}

export function isSelectModeActive(): boolean {
  return state.active
}
