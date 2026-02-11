// =============================================================================
// Stitch Tests - Overlap detection algorithm verification
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  computeRowSignatures,
  detectOverlap,
  stitchSegments,
  type PixelData,
} from '../lib/stitch'

// -----------------------------------------------------------------------------
// 测试数据工厂
// -----------------------------------------------------------------------------

/**
 * Knuth 乘法哈希 → 32-bit 伪随机值
 * 无 256 行周期性, 确保任意两行像素差异足够大
 */
function hash32(a: number, b: number): number {
  let h = ((a * 2654435761) ^ (b * 2246822519)) >>> 0
  h = ((h >>> 16) ^ h) * 0x45d9f3b >>> 0
  return h
}

/**
 * 生成 PixelData, 每行有独特的颜色模式
 * 使用 Knuth 哈希确保无周期性冲突
 */
function makePixels(width: number, height: number, rowOffset = 0): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    const row = y + rowOffset
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const h = hash32(row, x)
      data[i] = h & 0xFF           // R
      data[i + 1] = (h >> 8) & 0xFF  // G
      data[i + 2] = (h >> 16) & 0xFF // B
      data[i + 3] = 255              // A
    }
  }

  return { data, width, height }
}

/**
 * 创建带重叠的两段图像
 * imgA: rows [0, heightA)
 * imgB: rows [heightA - overlap, heightA - overlap + heightB)
 * 重叠区域: rows [heightA - overlap, heightA) 在两张图中出现
 */
function makePairWithOverlap(
  width: number,
  heightA: number,
  heightB: number,
  overlap: number,
): { imgA: PixelData; imgB: PixelData } {
  const imgA = makePixels(width, heightA, 0)
  const imgB = makePixels(width, heightB, heightA - overlap)
  return { imgA, imgB }
}

/**
 * 创建无重叠的两段图像
 * imgA: rows [0, heightA)
 * imgB: rows [heightA, heightA + heightB) — 完全不同的内容
 */
function makePairNoOverlap(
  width: number,
  heightA: number,
  heightB: number,
): { imgA: PixelData; imgB: PixelData } {
  const imgA = makePixels(width, heightA, 0)
  const imgB = makePixels(width, heightB, heightA) // 起始行 = heightA, 无重叠
  return { imgA, imgB }
}

// -----------------------------------------------------------------------------
// computeRowSignatures
// -----------------------------------------------------------------------------

describe('computeRowSignatures', () => {
  it('computes correct signature for a uniform row', () => {
    // 全红行: R=200, G=0, B=0 → avg = (200+0+0)/3 = 66.67
    const width = 10
    const data = new Uint8ClampedArray(width * 1 * 4)
    for (let x = 0; x < width; x++) {
      data[x * 4] = 200     // R
      data[x * 4 + 1] = 0   // G
      data[x * 4 + 2] = 0   // B
      data[x * 4 + 3] = 255 // A
    }

    const sigs = computeRowSignatures({ data, width, height: 1 }, 0, 1)

    // sig = sum(R+G+B) / (width * 3) = (200*10) / (10*3) = 66.67
    expect(sigs[0]).toBeCloseTo(200 / 3, 1)
  })

  it('returns different signatures for different rows', () => {
    const pixels = makePixels(50, 10)
    const sigs = computeRowSignatures(pixels, 0, 10)

    // 相邻行签名应有显著差异 (> SIG_TOLERANCE=2.0)
    for (let i = 1; i < sigs.length; i++) {
      // 不要求严格 > 2, 但至少大多数行对差异 > 0
      expect(sigs[i]).not.toBe(sigs[i - 1])
    }
  })

  it('handles partial row range', () => {
    const pixels = makePixels(20, 100)

    const fullSigs = computeRowSignatures(pixels, 0, 100)
    const partialSigs = computeRowSignatures(pixels, 50, 10)

    // partial 的第 0 个 = full 的第 50 个
    expect(partialSigs[0]).toBe(fullSigs[50])
    expect(partialSigs[9]).toBe(fullSigs[59])
  })
})

// -----------------------------------------------------------------------------
// detectOverlap
// -----------------------------------------------------------------------------

describe('detectOverlap', () => {
  it('detects exact 50px overlap', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 200, 200, 50)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(50)
  })

  it('detects exact 100px overlap', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 300, 300, 100)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(100)
  })

  it('detects small overlap (10px)', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 200, 200, 10)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(10)
  })

  it('returns 0 for non-overlapping images', () => {
    const { imgA, imgB } = makePairNoOverlap(100, 200, 200)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(0)
  })

  it('returns 0 when width mismatch', () => {
    const imgA = makePixels(100, 200)
    const imgB = makePixels(120, 200)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(0)
  })

  it('returns 0 when images too small', () => {
    const imgA = makePixels(100, 2)
    const imgB = makePixels(100, 2)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(0)
  })

  it('returns 0 when maxOverlap < actual overlap', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 200, 200, 50)

    // maxOverlap=30 < actual=50 → 搜索窗口内无完整匹配
    const overlap = detectOverlap(imgA, imgB, 30)

    expect(overlap).toBe(0)
  })

  it('detects overlap when maxOverlap >= actual overlap', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 200, 200, 50)

    // maxOverlap=60 >= actual=50 → 能检测到
    const overlap = detectOverlap(imgA, imgB, 60)

    expect(overlap).toBe(50)
  })

  it('handles overlap with wider images', () => {
    const { imgA, imgB } = makePairWithOverlap(400, 200, 200, 40)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(40)
  })

  it('detects overlap at MIN_OVERLAP boundary (4px)', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 100, 100, 4)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(4)
  })

  it('returns 0 for overlap below MIN_OVERLAP (3px)', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 100, 100, 3)

    // 3 < MIN_OVERLAP=4, 不可靠, 应返回 0
    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(0)
  })

  it('detects large overlap (500px in 800px images)', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 800, 800, 500)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(500)
  })

  it('detects overlap > 200px (old DEFAULT_MAX_OVERLAP)', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 400, 400, 300)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(300)
  })

  it('detects overlap that is most of the image height', () => {
    const { imgA, imgB } = makePairWithOverlap(100, 200, 200, 190)

    const overlap = detectOverlap(imgA, imgB)

    expect(overlap).toBe(190)
  })
})

// -----------------------------------------------------------------------------
// stitchSegments (需要 DOM 环境)
// -----------------------------------------------------------------------------

describe('stitchSegments', () => {
  it('throws error for empty segments', () => {
    expect(() => stitchSegments([])).toThrow('No segments to stitch')
  })
})
