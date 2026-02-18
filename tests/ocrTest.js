import Tesseract from 'tesseract.js'
import fs from 'fs'
import path from 'path'
import { createCanvas, loadImage } from 'canvas'
import substatNames from '../src/assets/data/substatNames.js'

const IMAGE_DIR = './tests/ocr-images/'
const EXPECTED = JSON.parse(fs.readFileSync(path.join(IMAGE_DIR, 'expected.json')))

// ---------------------------
// Helpers
// ---------------------------
function cleanOcrText(text) {
  return text
    .replace(/[%#&»@®£]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2)
    .join('\n')
}

async function sharpenImage(imagePath) {
  const img = await loadImage(imagePath)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const copy = new Uint8ClampedArray(data)
  const kernel = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0]

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      let r = 0,
        g = 0,
        b = 0,
        idx = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const i = ((y + ky) * canvas.width + (x + kx)) * 4
          r += copy[i] * kernel[idx]
          g += copy[i + 1] * kernel[idx]
          b += copy[i + 2] * kernel[idx]
          idx++
        }
      }
      const o = (y * canvas.width + x) * 4
      data[o] = Math.min(255, Math.max(0, r))
      data[o + 1] = Math.min(255, Math.max(0, g))
      data[o + 2] = Math.min(255, Math.max(0, b))
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toBuffer() // Buffer for Tesseract
}

function extractSubStat(text) {
  text = text.replace(/\s+/g, ' ')
  let bestMatch = null,
    bestIndex = Infinity
  for (const stat of substatNames) {
    const idx = text.indexOf(stat)
    if (idx !== -1 && idx < bestIndex) {
      bestIndex = idx
      bestMatch = stat
    }
  }
  if (!bestMatch) return { stat: null, value: null, remainingText: text }

  const valueMatch = text.match(new RegExp(`${bestMatch}\\s+([-+]?\\d+(?:\\.\\d+)?)`, 'i'))
  const value = valueMatch ? parseFloat(valueMatch[1]) : null
  const remainingText = valueMatch ? text.replace(valueMatch[0], '').trim() : text
  return { stat: bestMatch, value, remainingText }
}

function levenshtein(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

function fuzzyMatchStat(rawStat, allowedStats) {
  const normalized = rawStat.toLowerCase()
  let bestMatch = null,
    bestScore = Infinity
  for (const s of allowedStats) {
    const score = levenshtein(normalized, s.toLowerCase())
    if (score < bestScore) {
      bestScore = score
      bestMatch = s
    }
  }
  return bestScore <= 2 ? bestMatch : null
}

// ---------------------------
// Run tests
// ---------------------------
async function runTests() {
  for (const [fileName, expected] of Object.entries(EXPECTED)) {
    const filePath = path.join(IMAGE_DIR, fileName)

    // --- sharpen the image ---
    const sharpenedBuffer = await sharpenImage(await sharpenImage(filePath))

    // --- OCR ---
    const { data } = await Tesseract.recognize(sharpenedBuffer, 'eng')
    let text = cleanOcrText(data.text)
    console.log(`\nRaw OCR for ${fileName}:\n${text}\n---`)

    // Remove inactive marker
    if (text.includes('(+3 to activate)')) text = text.replace('(+3 to activate)', '').trim()

    // Extract main stat
    const mainLine = text.split('\n').find((l) => /\d/.test(l))
    let mainStat = null
    if (mainLine) {
      const match = mainLine.match(/([A-Za-z\s%]+)\s+([-+]?\d+(?:\.\d+)?)/)
      if (match) mainStat = { stat: match[1].trim(), value: parseFloat(match[2]) }
    }

    // Extract substats
    let remainingText = mainLine ? text.replace(mainLine, '').trim() : text
    const subStats = []
    for (let i = 0; i < 4; i++) {
      const res = extractSubStat(remainingText)
      if (!res.stat) break
      subStats.push({ stat: res.stat, value: res.value })
      remainingText = res.remainingText
    }

    // Compare
    const matchedMain = mainStat ? fuzzyMatchStat(mainStat.stat, [expected.mainStat.stat]) : null
    const mainOk = matchedMain && Math.abs(mainStat.value - expected.mainStat.value) < 0.01

    const subOk =
      subStats.length === expected.subStats.length &&
      subStats.every((s, i) => {
        const matchedSub = fuzzyMatchStat(s.stat, [expected.subStats[i].stat])
        return matchedSub && Math.abs(s.value - expected.subStats[i].value) < 0.01
      })

    console.log(`${fileName}:`, mainOk && subOk ? '✅ Passed' : '❌ Failed')
    console.log('OCR Main:', mainStat)
    console.log('Expected Main:', expected.mainStat)
    console.log('OCR Sub:', subStats)
    console.log('Expected Sub:', expected.subStats)
    console.log('---')

    console.assert(mainOk, `Main stat mismatch for ${fileName}`)
    console.assert(subOk, `Substats mismatch for ${fileName}`)
  }
}

runTests().catch(console.error)
