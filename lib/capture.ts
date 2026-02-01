// =============================================================================
// Image Capture - Use Chrome captureVisibleTab API to screenshot tweets
// =============================================================================

import { pauseSelectMode, resumeSelectMode } from './selector'

// CSS to inject before capture (minimal - only things that can't be detected dynamically)
const BASE_CAPTURE_CSS = `
  /* Hide our overlays */
  .x-screenshot-overlay {
    display: none !important;
  }
  /* Disable mouse events to prevent hover during scroll */
  body {
    pointer-events: none !important;
  }
  /* Remove hover background color on tweets */
  article[data-testid="tweet"] {
    background-color: transparent !important;
  }
`

let captureStyleElement: HTMLStyleElement | null = null
let customCss: string = ''
let formatTimeEnabled: boolean = true

/**
 * Set custom CSS to inject during capture
 */
export function setCustomCss(css: string): void {
  customCss = css
}

/**
 * Set whether to format time elements during capture
 */
export function setFormatTime(enabled: boolean): void {
  formatTimeEnabled = enabled
}

function injectCaptureStyles(): void {
  if (captureStyleElement) return

  captureStyleElement = document.createElement('style')
  captureStyleElement.id = 'x-screenshot-capture-styles'
  captureStyleElement.textContent = BASE_CAPTURE_CSS + '\n' + customCss
  document.head.appendChild(captureStyleElement)
}

function removeCaptureStyles(): void {
  captureStyleElement?.remove()
  captureStyleElement = null
}

// =============================================================================
// Dynamic sticky/fixed element hiding
// =============================================================================

const HIDDEN_ATTR = 'data-x-screenshot-hidden'

/**
 * Hide all position:fixed and position:sticky elements
 * Returns a restore function to unhide them
 */
function hideAllStickyFixed(): () => void {
  const hidden: HTMLElement[] = []

  document.querySelectorAll('body *').forEach(node => {
    if (!(node instanceof HTMLElement)) return

    // Skip our own elements
    if (node.classList.contains('x-screenshot-overlay')) return
    if (node.id === 'x-screenshot-capture-styles') return
    if (node.id === 'x-screenshot-selector-styles') return

    const position = getComputedStyle(node).position
    if (position === 'fixed' || position === 'sticky') {
      hidden.push(node)
      // Save original display value
      node.setAttribute(HIDDEN_ATTR, node.style.display || '')
      node.style.setProperty('display', 'none', 'important')
    }
  })

  return () => {
    hidden.forEach(node => {
      const prev = node.getAttribute(HIDDEN_ATTR)
      if (prev) {
        node.style.display = prev
      } else {
        node.style.removeProperty('display')
      }
      node.removeAttribute(HIDDEN_ATTR)
    })
  }
}

/**
 * Format all time elements to yyyy/MM/dd HH:mm format
 * Returns a restore function to revert to original content
 */
function formatTimeElements(): () => void {
  if (!formatTimeEnabled) return () => {}

  const saved = new Map<HTMLElement, string>()

  document.querySelectorAll('time[datetime]').forEach(el => {
    if (!(el instanceof HTMLElement)) return
    const datetime = el.getAttribute('datetime')
    if (!datetime) return

    const date = new Date(datetime)
    if (isNaN(date.getTime())) return

    // Save original content
    saved.set(el, el.textContent || '')

    // Format as yyyy/MM/dd HH:mm
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    el.textContent = `${year}/${month}/${day} ${hours}:${minutes}`
  })

  return () => {
    saved.forEach((original, el) => {
      el.textContent = original
    })
  }
}

/**
 * Clear all tweet outline styles and return restore function
 * Must use removeProperty to clear !important styles set by selector.ts
 */
function clearAllTweetOutlines(): () => void {
  const saved = new Map<HTMLElement, { outline: string; outlineOffset: string }>()

  document.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {
    if (tweet instanceof HTMLElement) {
      // Save current values
      saved.set(tweet, {
        outline: tweet.style.getPropertyValue('outline'),
        outlineOffset: tweet.style.getPropertyValue('outline-offset'),
      })
      // Clear
      tweet.style.removeProperty('outline')
      tweet.style.removeProperty('outline-offset')
    }
  })

  // Return restore function
  return () => {
    saved.forEach((styles, tweet) => {
      if (styles.outline) {
        tweet.style.setProperty('outline', styles.outline, 'important')
      }
      if (styles.outlineOffset) {
        tweet.style.setProperty('outline-offset', styles.outlineOffset, 'important')
      }
    })
  }
}

/**
 * Capture a single element using captureVisibleTab
 * Handles elements taller than viewport by capturing in segments
 */
async function captureElement(el: Element): Promise<string> {
  const elRect = el.getBoundingClientRect()
  const elTop = window.scrollY + elRect.top
  const elHeight = elRect.height
  const elWidth = elRect.width
  const viewportHeight = window.innerHeight
  const dpr = window.devicePixelRatio

  // Validate element has size
  if (elWidth <= 0 || elHeight <= 0) {
    throw new Error(`captureElement: Element has no size (${elWidth}x${elHeight})`)
  }

  // If element fits in viewport, do a simple capture
  if (elHeight <= viewportHeight) {
    // Center element in viewport for better visual context
    el.scrollIntoView({ behavior: 'instant', block: 'center' })
    await new Promise(r => setTimeout(r, 100))

    // Verify element is fully visible, if not use segment capture
    const newRect = el.getBoundingClientRect()
    if (newRect.top >= 0 && newRect.bottom <= viewportHeight) {
      return captureVisiblePortion(el)
    }
    // Fall through to segment capture if still not fully visible
  }

  // Element is taller than viewport - capture in segments
  const segments: HTMLImageElement[] = []
  let capturedHeight = 0

  while (capturedHeight < elHeight) {
    // Calculate how much of the element we can see
    const scrollTarget = elTop + capturedHeight
    window.scrollTo({ top: scrollTarget, behavior: 'instant' })
    await new Promise(r => setTimeout(r, 100))

    // Get current visible rect of the element
    const rect = el.getBoundingClientRect()

    // Calculate the visible portion
    const visibleTop = Math.max(0, rect.top)
    const visibleBottom = Math.min(viewportHeight, rect.bottom)
    const visibleHeight = visibleBottom - visibleTop

    if (visibleHeight <= 0) break

    // Validate dimensions before creating canvas
    const canvasWidth = Math.round(rect.width * dpr)
    const canvasHeight = Math.round(visibleHeight * dpr)

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      throw new Error(`captureElement: Invalid segment size (${canvasWidth}x${canvasHeight})`)
    }

    // Capture this segment
    const dataUrl = await requestCapture()
    const segmentImg = await loadImage(dataUrl)

    // Crop to the visible portion of the element
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    ctx.drawImage(
      segmentImg,
      rect.x * dpr,
      visibleTop * dpr,
      rect.width * dpr,
      visibleHeight * dpr,
      0,
      0,
      canvasWidth,
      canvasHeight
    )

    const croppedImg = await loadImage(canvas.toDataURL('image/png'))
    segments.push(croppedImg)

    capturedHeight += visibleHeight
  }

  // Validate we captured something
  if (segments.length === 0) {
    throw new Error('captureElement: No segments captured')
  }

  // Stitch segments vertically
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const totalHeight = segments.reduce((sum, img) => sum + img.height, 0)
  const maxWidth = Math.max(...segments.map(img => img.width))

  canvas.width = maxWidth
  canvas.height = totalHeight

  let y = 0
  for (const img of segments) {
    ctx.drawImage(img, 0, y)
    y += img.height
  }

  return canvas.toDataURL('image/png')
}

/**
 * Capture the visible portion of an element (simple case)
 */
async function captureVisiblePortion(el: Element): Promise<string> {
  const rect = el.getBoundingClientRect()
  const dpr = window.devicePixelRatio

  // Validate dimensions
  const canvasWidth = Math.round(rect.width * dpr)
  const canvasHeight = Math.round(rect.height * dpr)

  if (canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error(`captureVisiblePortion: Invalid size (${canvasWidth}x${canvasHeight})`)
  }

  const dataUrl = await requestCapture()
  const img = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  canvas.width = canvasWidth
  canvas.height = canvasHeight

  ctx.drawImage(
    img,
    rect.x * dpr,
    rect.y * dpr,
    rect.width * dpr,
    rect.height * dpr,
    0,
    0,
    canvasWidth,
    canvasHeight
  )

  return canvas.toDataURL('image/png')
}

/**
 * Load an image from data URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('loadImage: Empty image source'))
      return
    }
    if (!src.startsWith('data:image/')) {
      reject(new Error(`loadImage: Invalid data URL format: ${src.slice(0, 100)}`))
      return
    }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`loadImage: Failed to decode image (length=${src.length})`))
    img.src = src
  })
}

/**
 * Request screenshot from background script
 */
async function requestCapture(): Promise<string> {
  const response = await browser.runtime.sendMessage({
    action: 'captureVisibleTab',
  }) as { dataUrl?: string; error?: string }

  if (response.error) {
    throw new Error(`captureVisibleTab failed: ${response.error}`)
  }
  if (!response.dataUrl) {
    throw new Error('captureVisibleTab returned empty dataUrl')
  }
  return response.dataUrl
}

/**
 * Capture a single element immediately (for eager capture on selection)
 * Returns the captured image as a data URL
 *
 * Note: In virtual list environments (like Twitter), trying to restore exact
 * scroll position is unreliable due to dynamic content loading and DOM recycling.
 * Instead, we center the captured element after completion - a predictable behavior.
 */
export async function captureSingleElement(el: Element): Promise<string> {
  // Pause selector events to prevent any new hover styles
  pauseSelectMode()
  injectCaptureStyles()  // Hides overlays and Grok button
  const restoreStickyFixed = hideAllStickyFixed()  // Hide all fixed/sticky elements
  const restoreOutlines = clearAllTweetOutlines()  // Clear tweet outlines
  const restoreTime = formatTimeElements()  // Format time elements
  await new Promise(r => requestAnimationFrame(r))

  let result: string
  try {
    result = await captureElement(el)
  } finally {
    restoreTime()  // Restore original time text
    restoreOutlines()  // Restore previously selected tweet outlines
    restoreStickyFixed()  // Restore fixed/sticky elements
    removeCaptureStyles()
    resumeSelectMode()  // Resume event handling
  }

  // Wait for layout to fully stabilize, then center
  // Use setTimeout to ensure all pending layout/paint operations complete
  await new Promise(r => setTimeout(r, 50))
  el.scrollIntoView({ behavior: 'instant', block: 'center' })

  return result
}

/**
 * Stitch multiple pre-captured images vertically
 */
export async function stitchImages(dataUrls: string[]): Promise<string> {
  if (dataUrls.length === 0) {
    throw new Error('stitchImages: No images to stitch')
  }

  const images: HTMLImageElement[] = []
  for (const url of dataUrls) {
    const img = await loadImage(url)
    images.push(img)
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const totalHeight = images.reduce((sum, img) => sum + img.height, 0)
  const maxWidth = Math.max(...images.map(img => img.width))

  canvas.width = maxWidth
  canvas.height = totalHeight

  // Fill background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw images
  let y = 0
  for (const img of images) {
    const x = (maxWidth - img.width) / 2
    ctx.drawImage(img, x, y)
    y += img.height
  }

  return canvas.toDataURL('image/png')
}

/**
 * Capture multiple elements and stitch them vertically
 * @deprecated Use captureSingleElement + stitchImages for virtual list compatibility
 */
export async function captureElements(elements: Element[]): Promise<string> {
  // Inject capture styles to hide overlays and Grok button
  injectCaptureStyles()

  // Wait a frame for styles to apply
  await new Promise(r => requestAnimationFrame(r))

  try {
    const images: HTMLImageElement[] = []

    // Capture each element
    for (const el of elements) {
      const dataUrl = await captureElement(el)
      const img = await loadImage(dataUrl)
      images.push(img)
    }

    // Stitch images vertically
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const totalHeight = images.reduce((sum, img) => sum + img.height, 0)
    const maxWidth = Math.max(...images.map(img => img.width))

    canvas.width = maxWidth
    canvas.height = totalHeight

    // Fill background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw images
    let y = 0
    for (const img of images) {
      const x = (maxWidth - img.width) / 2
      ctx.drawImage(img, x, y)
      y += img.height
    }

    return canvas.toDataURL('image/png')
  } finally {
    removeCaptureStyles()
  }
}

export function downloadImage(dataUrl: string, filename = 'tweet.png'): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

export async function copyImageToClipboard(dataUrl: string): Promise<void> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob })
  ])
}
