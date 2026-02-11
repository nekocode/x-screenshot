// =============================================================================
// Image Stitch - Overlap detection and smart vertical stitching
// =============================================================================
//
// 算法: Row Signature + Pixel Verification (两阶段)
//   Phase 1: 逐行计算 RGB 平均值作为签名, 快速匹配候选重叠量
//   Phase 2: 像素级 SAD 验证, 排除误匹配
//
// 参考: Sum of Absolute Differences (SAD) - 经典模板匹配算法
// =============================================================================

// 签名匹配容差: 每像素每通道平均差异
const SIG_TOLERANCE = 2.0

// 签名匹配要求: 行匹配比例
const SIG_MATCH_RATIO = 0.9

// 像素验证容差: 每像素每通道平均差异
const PIXEL_TOLERANCE = 5.0

// 最小有效重叠: 低于此值不可靠
const MIN_OVERLAP = 4

// -----------------------------------------------------------------------------
// 像素数据接口 (兼容 ImageData 和测试用 plain object)
// -----------------------------------------------------------------------------

export interface PixelData {
  data: Uint8ClampedArray
  width: number
  height: number
}

// -----------------------------------------------------------------------------
// Phase 1: 行签名计算
// -----------------------------------------------------------------------------

/**
 * 计算指定行范围的 RGB 平均值签名
 * sig[i] = 该行所有像素 (R+G+B) 的平均值 / 3
 */
export function computeRowSignatures(
  pixels: PixelData,
  startRow: number,
  numRows: number,
): Float64Array {
  const { data, width } = pixels
  const sigs = new Float64Array(numRows)

  for (let r = 0; r < numRows; r++) {
    let sum = 0
    const rowOffset = (startRow + r) * width * 4

    for (let x = 0; x < width; x++) {
      const i = rowOffset + x * 4
      sum += data[i] + data[i + 1] + data[i + 2]
    }

    sigs[r] = sum / (width * 3)
  }

  return sigs
}

// -----------------------------------------------------------------------------
// Phase 2: 重叠检测
// -----------------------------------------------------------------------------

/**
 * 检测 imgA 底部与 imgB 顶部的重叠行数
 *
 * 策略: 从 maxOverlap 向下搜索, 找到第一个满足
 *   "90%+ 行签名匹配 且 像素验证通过" 的 k 值
 *
 * @returns 重叠行数 (0 = 无重叠)
 */
export function detectOverlap(
  imgA: PixelData,
  imgB: PixelData,
  maxOverlap?: number,
): number {
  // 宽度不一致无法比较
  if (imgA.width !== imgB.width) return 0

  // 默认搜索范围: 较短图像的高度 - MIN_OVERLAP
  const effectiveMax = maxOverlap ?? (Math.min(imgA.height, imgB.height) - MIN_OVERLAP)
  const searchLimit = Math.min(effectiveMax, imgA.height, imgB.height)
  if (searchLimit < MIN_OVERLAP) return 0

  // Phase 1: 计算签名
  const sigsA = computeRowSignatures(imgA, imgA.height - searchLimit, searchLimit)
  const sigsB = computeRowSignatures(imgB, 0, searchLimit)

  // Phase 1: 从大到小搜索匹配
  for (let k = searchLimit; k >= MIN_OVERLAP; k--) {
    if (matchSignatures(sigsA, sigsB, searchLimit, k)) {
      // Phase 2: 像素验证
      if (verifyPixels(imgA, imgB, k)) {
        return k
      }
    }
  }

  return 0
}

/**
 * 签名序列匹配: A 的最后 k 个 vs B 的前 k 个
 */
function matchSignatures(
  sigsA: Float64Array,
  sigsB: Float64Array,
  searchLimit: number,
  k: number,
): boolean {
  let matched = 0
  const aOffset = searchLimit - k

  for (let i = 0; i < k; i++) {
    if (Math.abs(sigsA[aOffset + i] - sigsB[i]) < SIG_TOLERANCE) {
      matched++
    }
  }

  return matched / k >= SIG_MATCH_RATIO
}

/**
 * 像素级 SAD 验证: 均匀采样多行做精确比对
 * 采样数量随重叠大小增长, 避免大重叠区域的误匹配
 */
function verifyPixels(
  imgA: PixelData,
  imgB: PixelData,
  overlap: number,
): boolean {
  const width = imgA.width

  // 采样数: 最少 3 行, 每 50 行加 1, 最多 10 行
  const numSamples = Math.min(10, Math.max(3, Math.ceil(overlap / 50)))

  for (let i = 0; i < numSamples; i++) {
    // 均匀分布在 [0, overlap-1]
    const r = numSamples === 1
      ? 0
      : Math.floor(i * (overlap - 1) / (numSamples - 1))

    const aRowOffset = (imgA.height - overlap + r) * width * 4
    const bRowOffset = r * width * 4
    let diff = 0

    for (let x = 0; x < width; x++) {
      const ai = aRowOffset + x * 4
      const bi = bRowOffset + x * 4
      diff += Math.abs(imgA.data[ai] - imgB.data[bi])
      diff += Math.abs(imgA.data[ai + 1] - imgB.data[bi + 1])
      diff += Math.abs(imgA.data[ai + 2] - imgB.data[bi + 2])
    }

    if (diff / (width * 3) > PIXEL_TOLERANCE) return false
  }

  return true
}

// -----------------------------------------------------------------------------
// 拼接
// -----------------------------------------------------------------------------

// Canvas 或 Image 的统一尺寸接口
type Segment = HTMLCanvasElement | HTMLImageElement

function segmentWidth(s: Segment): number {
  return s instanceof HTMLCanvasElement ? s.width : s.width
}
function segmentHeight(s: Segment): number {
  return s instanceof HTMLCanvasElement ? s.height : s.height
}

/**
 * 智能拼接: 自动检测相邻段重叠并裁剪
 * 接受 Canvas 或 Image, 避免不必要的 PNG 编解码
 *
 * @param segments - 分段图像 (Canvas[] 或 Image[])
 * @returns 拼接后的 Canvas
 */
export function stitchSegments(segments: Segment[]): HTMLCanvasElement {
  if (segments.length === 0) {
    throw new Error('stitchSegments: No segments to stitch')
  }

  // 单段直接返回
  if (segments.length === 1) {
    const s = segments[0]
    if (s instanceof HTMLCanvasElement) return s
    const canvas = document.createElement('canvas')
    canvas.width = s.width
    canvas.height = s.height
    canvas.getContext('2d')!.drawImage(s, 0, 0)
    return canvas
  }

  // 提取所有段的像素数据
  const pixelDataList = segments.map(toPixelData)

  // 检测相邻段重叠量
  const overlaps: number[] = [0]
  for (let i = 1; i < pixelDataList.length; i++) {
    overlaps.push(detectOverlap(pixelDataList[i - 1], pixelDataList[i]))
  }

  // 计算最终画布尺寸
  const maxWidth = Math.max(...segments.map(segmentWidth))
  let totalHeight = 0
  for (let i = 0; i < segments.length; i++) {
    totalHeight += segmentHeight(segments[i]) - overlaps[i]
  }

  // 绘制
  const canvas = document.createElement('canvas')
  canvas.width = maxWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')!

  let y = 0
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const skip = overlaps[i]
    const w = segmentWidth(seg)
    const h = segmentHeight(seg)

    ctx.drawImage(
      seg,
      0, skip,             // 源: 跳过重叠行
      w, h - skip,         // 源: 剩余区域
      0, y,                // 目标
      w, h - skip,         // 目标尺寸
    )

    y += h - skip
  }

  return canvas
}

/**
 * Canvas 或 Image → PixelData
 * Canvas 直接 getImageData (零拷贝), Image 需要临时 Canvas
 */
function toPixelData(source: Segment): PixelData {
  if (source instanceof HTMLCanvasElement) {
    const ctx = source.getContext('2d')!
    const d = ctx.getImageData(0, 0, source.width, source.height)
    return { data: d.data, width: d.width, height: d.height }
  }

  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  const d = ctx.getImageData(0, 0, source.width, source.height)
  return { data: d.data, width: d.width, height: d.height }
}
