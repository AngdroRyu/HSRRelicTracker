<script setup>
import { ref, reactive, computed, nextTick, watch } from 'vue'
import Tesseract from 'tesseract.js'
import relicDomains from '@/data/relics.json'
import mainStatsBySlot from '@/assets/data/mainStat.js'
import substatNames from '@/assets/data/substatNames.js'
import SubstatGrowthValues from '@/data/substatGrowthValues.json'
import relicLookup from '@/data/relicLookup.json'

// --------------------
// Reactive state
// --------------------
const uploadedImage = ref(null)
const ocrText = ref('')
const progress = ref(0)
const fileInput = ref(null)
const fileInputKey = ref(0)
const domain = ref('')
const setName = ref('')
const props = defineProps(['relics'])
const fileQueue = ref([])
const pendingRelics = ref([])
const currentIndex = ref(0)

// Temporary test relics
// props.relics.push({
//   name: 'Test Relic',
//   set: 'Test Set',
//   slot: 'Head',
//   mainStat: { stat: 'ATK', value: 42 },
//   subStatsName: [
//     { stat: 'CRIT Rate', value: 10.6, count: 1, colorType: 1 },
//     { stat: 'ATK', value: 4.3, count: 2, colorType: 2 },
//     { stat: 'SPD', value: 4, count: 3, colorType: 3 },
//   ],
// })

const emit = defineEmits(['update:relics'])

function removeRelic(index) {
  const updated = [...props.relics]
  updated.splice(index, 1)
  emit('update:relics', updated)
}

const relic = reactive({
  name: '',
  set: '',
  slot: '',
  domain: '',
  mainStat: { stat: '', value: null },
  subStatsName: [],
  imagePath: '', // optional, for set image
})
const rollTable = Object.fromEntries(
  SubstatGrowthValues.map((r) => [r.stat, [r.values.low, r.values.med, r.values.high]]),
)

const MAX_SUBSTATS = 4

// --------------------
// Computed properties
// --------------------
// Mental note: computed for filters, mapping, comparisons, and selections
const sets = computed(() => {
  const domainObj = relicDomains.domains.find((d) => d.name === relic.domain)
  return domainObj?.sets || []
})

const selectedSet = computed(() => sets.value.find((s) => s.name === relic.set))

const slotMainStats = computed(() => {
  const pieces = selectedSet.value?.pieces
  const mainStats = pieces?.[relic.slot]?.mainStats?.map((m) => m.stat)
  if (!mainStats || mainStats.length === 0) return mainStatsBySlot[relic.slot] || []
  return mainStats
})

const slotSubStats = computed(() => selectedSet.value?.pieces?.[relic.slot]?.subStats || [])
const filteredSubStats = computed(() => slotSubStats.value.filter((s) => s !== relic.mainStat.stat))

const allSubStats = computed(() => {
  return Array.from(new Set([...substatNames]))
})

// Determine which image to display
const relicImage = computed(() => {
  const image = selectedSet.value?.imagePath
  return image ? `${import.meta.env.BASE_URL}relics/${image}` : uploadedImage.value || ''
})

const substatRollPreview = computed(() => {
  return relic.subStatsName.map((sub) => {
    // Use normalized & rounded value
    const normalizedValue = normalizeSubstatValue(sub.stat, sub.value)
    const rollInfo = detectSubstatRolls(sub.stat, normalizedValue)

    return {
      ...sub,
      rolls: rollInfo?.breakdown ?? null,
      totalRolls: rollInfo?.totalRolls ?? 0,
    }
  })
})
const hasInvalidSubstats = computed(() => {
  return relic.subStatsName.some(
    (s) => !s.stat || s.value === null || s.value === undefined || s.value === '',
  )
})
const hasInvalidMainStat = computed(() => {
  return !relic.mainStat.stat || relic.mainStat.value === null || relic.mainStat.value === undefined
})
const hasSubstats = computed(() => relic.subStatsName.length > 0)

// --------------------
// File upload & OCR
// --------------------
async function handleFiles(ev) {
  const files = Array.from(ev.target.files)
  if (!files.length) return

  fileQueue.value.push(...files)

  // If nothing is being reviewed, start processing
  if (pendingRelics.value.length === 0) {
    await processNextFile()
  }

  fileInputKey.value += 1
}
async function processNextFile() {
  if (!fileQueue.value.length) return

  const file = fileQueue.value.shift()
  resetForm(false) // keep uploadedImage for preview
  uploadedImage.value = URL.createObjectURL(file)

  const localRelic = {
    name: '',
    set: '',
    slot: '',
    domain: '',
    mainStat: { stat: '', value: null },
    subStatsName: [],
    imagePath: '',
  }
  const sharpened = await sharpenImage(uploadedImage.value)
  try {
    const { data } = await Tesseract.recognize(sharpened, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          progress.value = Math.round(m.progress * 100)
        }
      },
    })

    console.log('OCR Data:', data)

    // --- Step 1: Clean OCR text ---
    let text = cleanOcrText(data.text)
    text = text.replace(/[@&®£]/g, '').trim() // remove common OCR junk
    console.log('Cleaned OCR Text:', text)

    // --- Step 2: Match relic name using relicLookup.json ---
    let matchedName = ''
    let bestScore = 0
    const normalizedText = text.toLowerCase()

    for (const name of Object.keys(relicLookup)) {
      const words = name.toLowerCase().split(/\s+/)
      let score = 0
      for (const w of words) if (normalizedText.includes(w)) score++
      if (score >= Math.ceil(words.length / 2) && score > bestScore) {
        bestScore = score
        matchedName = name
      }
    }

    if (!matchedName) {
      console.warn('No relic found for OCR text:', text)
      return
    }

    const relicData = relicLookup[matchedName]

    // Fill localRelic directly
    localRelic.name = relicData.name || matchedName
    localRelic.set = relicData.set
    localRelic.slot = relicData.slot
    localRelic.domain = relicData.domain || ''
    localRelic.imagePath = relicData.imagePath || ''

    console.log('Matched relic from lookup:', localRelic)

    // Remove matched name from text for parsing stats
    text = text.replace(matchedName, '').trim()

    // --- Step 3: Extract Main Stat (first or second line) ---
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    const allowedStats = mainStatsBySlot[localRelic.slot] || []
    let mainStatFound = false

    for (let i = 0; i < Math.min(2, lines.length); i++) {
      const line = lines[i]
      console.log('Attempting to extract main stat from line:', line)

      const match = line.match(/([A-Za-z\s%]+)\s+([-+]?\d+(?:\.\d+)?)/)

      if (!match) continue

      const rawStat = match[1].trim()
      const value = parseFloat(match[2])

      // Try to match OCR stat to allowed main stats
      const matchedStat = allowedStats.find((s) => rawStat.toLowerCase().includes(s.toLowerCase()))

      if (!matchedStat) {
        console.warn('Main stat not recognized:', rawStat)
        continue
      }

      // ✅ Found valid main stat
      localRelic.mainStat.stat = matchedStat
      localRelic.mainStat.value = value
      mainStatFound = true

      // Remove ONLY the matched line
      text = text.replace(line, '').trim()

      console.log('Extracted main stat:', matchedStat, value)
      break
    }

    if (!mainStatFound) {
      console.warn('Failed to detect main stat from first two lines:', lines.slice(0, 2))
    }

    // --- Step 4: Extract Substats ---
    localRelic.subStatsName = []
    if (text.includes('(+3 to activate)')) {
      text = text.replace('(+3 to activate)', '').trim()
      //possibly add checkbox to mark as "inactive"
    }
    for (let i = 0; i < MAX_SUBSTATS; i++) {
      const res = extractSubStat(text)

      // Break if extractSubStat returned null or no stat found
      if (!res || !res.stat) break

      localRelic.subStatsName.push({ stat: res.stat, value: res.value })
      text = res.remainingText
    }

    // --- Step 5: Load into editor for manual review ---
    Object.assign(relic, JSON.parse(JSON.stringify(localRelic)))
  } catch (err) {
    console.error('OCR error:', err)
  }
}

// --------------------
// Helpers
// --------------------
function cleanOcrText(text) {
  return (
    text
      // Fix elemental icon misreads (Lightning, Fire, etc.)

      // Remove common OCR junk symbols
      .replace(/[%#&»@®£]/g, '')

      // Fix broken lines
      .replace(/\r\n/g, '\n')
      .replace(/\n{2,}/g, '\n')

      // Remove junk standalone lines
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 2 && !/^(Fe|in|;|\(0\))$/i.test(line))
      .join('\n')
  )
}

watch(
  () => [relic.set, relic.slot],
  ([newSet, newSlot]) => {
    if (!newSet || !newSlot) return

    // Find relic in relicLookup matching set + slot
    const matchingName = Object.values(relicLookup).find(
      (r) => r.set === newSet && r.slot === newSlot,
    )?.name

    if (matchingName) {
      relic.name = matchingName
    }
  },
)

function extractSubStat(text) {
  text = text.replace(/\s+/g, ' ')
  console.log('Extracting substat from text:', text)
  let bestMatch = null
  let bestIndex = Infinity
  for (const stat of substatNames) {
    const idx = text.indexOf(stat)
    if (idx !== -1 && idx < bestIndex) {
      bestIndex = idx
      bestMatch = stat
    }
  }
  if (!bestMatch) return { stat: null, value: null, remainingText: text }
  const valueMatch = text.match(new RegExp(`${bestMatch}\\s+([-+]?\\d+(?:\\.\\d+)?)`, 'i'))

  const value = valueMatch ? parseStatValue(valueMatch[1]) : null
  const fullText = valueMatch ? valueMatch[0] : bestMatch
  const remainingText = text.replace(fullText, '').trim()
  return { stat: bestMatch, value, remainingText }
}
function parseStatValue(raw) {
  if (!raw) return null
  const value = parseFloat(raw)
  return value
}

function resetForm(clearImage = true) {
  domain.value = ''
  setName.value = ''
  relic.name = ''
  relic.set = ''
  relic.slot = ''
  relic.domain = ''
  relic.mainStat.stat = ''
  relic.mainStat.value = null
  relic.subStatsName = []
  if (clearImage) uploadedImage.value = null
  ocrText.value = ''
  progress.value = 0
}
function clearCurrentAndNext() {
  // discard current relic + image
  resetForm(false)

  if (uploadedImage.value) {
    URL.revokeObjectURL(uploadedImage.value)
    uploadedImage.value = null
  }

  progress.value = 0

  // move to next file in queue
  processNextFile()
}

function clearAllUploads() {
  resetForm()

  if (uploadedImage.value) {
    URL.revokeObjectURL(uploadedImage.value)
    uploadedImage.value = null
  }

  fileQueue.value = []
  progress.value = 0
}

function addSubstat() {
  if (relic.subStatsName.length >= MAX_SUBSTATS) return
  relic.subStatsName.push({ stat: '', value: null })
}

function removeSubstat(index) {
  relic.subStatsName.splice(index, 1)
}
function formatStatValue(stat, value) {
  if (value === null || value === undefined) return '—'

  // show % if stat is percentage-based or value has decimals
  const isPercent = stat.includes('%') || !Number.isInteger(value)

  return isPercent ? `${value}%` : value
}
function addRelic() {
  const newRelic = {
    name: relic.name,
    set: relic.set,
    slot: relic.slot,
    mainStat: { ...relic.mainStat },
    subStatsName: relic.subStatsName.map((s) => ({ ...s })),
  }

  emit('update:relics', [...props.relics, newRelic])

  resetForm(false)

  // Move to next queued image
  processNextFile()
}

function normalizeSubstatValue(stat, value) {
  if (value == null) return null

  const percentOnlyStats = [
    'CRIT Rate',
    'CRIT DMG',
    'Effect Hit Rate',
    'Effect RES',
    'Break Effect',
  ]

  // Always percent-based stats
  if (percentOnlyStats.includes(stat)) {
    return value / 100
  }

  // ATK / DEF / HP:
  // decimal → percent, integer → flat
  if (['ATK', 'DEF', 'HP'].includes(stat)) {
    return Number.isInteger(value) ? value : value / 100
  }

  // Everything else (SPD, etc.)
  return value
}

function detectSubstatRolls(stat, observedValue, maxRolls = 5) {
  const tableStat =
    ['ATK', 'DEF', 'HP'].includes(stat) && !Number.isInteger(observedValue * 100)
      ? stat + '%'
      : stat

  const values = rollTable[tableStat]
  if (!values) return null

  const tolerance = tableStat.endsWith('%') ? 0.01 : 1
  const [low, med, high] = values

  let best = null
  let bestDiff = Infinity

  for (let a = 0; a <= maxRolls; a++) {
    for (let b = 0; b <= maxRolls - a; b++) {
      for (let c = 0; c <= maxRolls - a - b; c++) {
        const rolls = a + b + c
        if (!rolls) continue

        const sum = a * low + b * med + c * high
        const diff = Math.abs(sum - observedValue)

        if (diff < bestDiff && diff <= tolerance) {
          bestDiff = diff
          best = {
            totalRolls: rolls,
            breakdown: { low: a, med: b, high: c },
          }
        }
      }
    }
  }

  return best
}
async function sharpenImage(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const width = canvas.width
      const height = canvas.height

      // Sharpen kernel
      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]

      const copy = new Uint8ClampedArray(data)

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let r = 0,
            g = 0,
            b = 0
          let idx = 0

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const i = ((y + ky) * width + (x + kx)) * 4
              r += copy[i] * kernel[idx]
              g += copy[i + 1] * kernel[idx]
              b += copy[i + 2] * kernel[idx]
              idx++
            }
          }

          const o = (y * width + x) * 4
          data[o] = Math.min(255, Math.max(0, r))
          data[o + 1] = Math.min(255, Math.max(0, g))
          data[o + 2] = Math.min(255, Math.max(0, b))
        }
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL())
    }

    img.src = imageUrl
  })
}
</script>

<template>
  <div class="flex items-start justify-center gap-6 p-6">
    <p class="text-xs text-gray-400">Remaining uploads: {{ fileQueue.length }}</p>

    <!-- LEFT: Uploaded Image -->
    <div class="w-64 sticky top-6">
      <div class="border rounded bg-neutral-800 p-2 flex justify-center items-center">
        <img
          v-if="uploadedImage"
          :src="uploadedImage"
          alt="Uploaded Relic"
          class="max-w-full max-h-[400px] object-contain rounded border-2 border-lime-500"
        />
        <div v-else class="w-full h-64 flex items-center justify-center text-gray-400">
          No image
        </div>
      </div>
    </div>
    <!-- Form Card -->
    <div class="p-4 border rounded-md max-w-md space-y-4 bg-stone-800 text-white w-full">
      <h3 class="text-lg font-semibold">OCR Relic Reader</h3>

      <!-- File Upload -->
      <div class="flex gap-2">
        <button
          @click="fileInput.click()"
          class="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500"
        >
          Upload Image
        </button>
        <button
          @click="clearCurrentAndNext"
          :disabled="!uploadedImage && !fileQueue.length"
          class="flex-1 px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-50"
        >
          Clear
        </button>

        <button
          @click="clearAllUploads"
          class="flex-1 px-4 py-2 rounded bg-red-700 hover:bg-red-600"
        >
          Clear All
        </button>
      </div>
      <input
        type="file"
        ref="fileInput"
        :key="fileInputKey"
        class="hidden"
        @change="handleFiles"
        accept="image/*"
        multiple
      />

      <!-- OCR Progress -->
      <div v-if="progress > 0" class="w-full bg-gray-700 rounded h-4 overflow-hidden mt-2">
        <div class="bg-blue-600 h-4" :style="{ width: progress + '%' }"></div>
      </div>

      <!-- Domain -->
      <select v-model="relic.domain" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Domain</option>
        <option v-for="d in relicDomains.domains || []" :key="d.name" :value="d.name">
          {{ d.name }}
        </option>
      </select>

      <!-- Set -->
      <select v-model="relic.set" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Set</option>
        <option v-for="s in sets || []" :key="s.name" :value="s.name">
          {{ s.name }}
        </option>
      </select>

      <!-- Slot -->
      <select v-model="relic.slot" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Slot</option>
        <option v-for="s in Object.keys(selectedSet?.pieces || {})" :key="s" :value="s">
          {{ s }}
        </option>
      </select>

      <!-- Main Stat -->
      <select
        v-if="slotMainStats?.length > 0"
        v-model="relic.mainStat.stat"
        class="border p-2 rounded w-full bg-stone-800 text-white"
      >
        <option value="">Select Main Stat</option>
        <option v-for="ms in slotMainStats || []" :key="ms" :value="ms">{{ ms }}</option>
      </select>

      <input
        v-model.number="relic.mainStat.value"
        type="number"
        step="0.1"
        placeholder="Value"
        class="border p-2 rounded w-full bg-stone-800 text-white"
      />
      <!-- Substats -->
      <div>
        <label class="block mb-2">Substats (max {{ MAX_SUBSTATS }})</label>
        <div class="space-y-2">
          <div
            v-for="(sub, index) in relic.subStatsName || []"
            :key="index"
            class="flex items-center space-x-3"
          >
            <select v-model="sub.stat" class="border p-2 rounded w-1/2 bg-stone-800 text-white">
              <option value="">Select Substat</option>
              <option
                v-for="stat in Array.from(
                  new Set([
                    ...(filteredSubStats.length ? filteredSubStats : allSubStats),
                    sub.stat,
                  ]),
                )"
                :key="stat"
                :value="stat"
              >
                {{ stat }}
              </option>
            </select>

            <input
              v-model.number="sub.value"
              type="number"
              step="0.1"
              placeholder="Value"
              class="border p-2 rounded w-1/4 bg-stone-800 text-white"
            />

            <button
              @click="removeSubstat(index)"
              class="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white"
            >
              Remove
            </button>
          </div>

          <button
            v-if="(relic.subStatsName?.length || 0) < MAX_SUBSTATS"
            @click="addSubstat"
            class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            Add Substat
          </button>
        </div>
      </div>
    </div>

    <!-- Preview Card -->
    <div class="w-80 border p-4 rounded bg-neutral-800 text-white">
      <h4 class="font-semibold mb-2">Current Relic Preview</h4>
      <div class="mb-4 flex justify-center bg-neutral-700/80 p-2 rounded">
        <!-- Use relic set image if available, fallback to uploaded image -->
        <img
          v-if="relicImage"
          :src="relicImage"
          :alt="relic.name || 'Relic Image'"
          class="max-w-full rounded"
        />
      </div>

      <p><strong>Piece:</strong> {{ relic.slot || '—' }}</p>
      <p><strong>Domain:</strong> {{ relic.domain || '—' }}</p>
      <p><strong>Set:</strong> {{ relic.set || '—' }}</p>
      <p>
        <strong>Main Stat:</strong>
        {{ relic.mainStat.stat || '—' }}
        {{ formatStatValue(relic.mainStat.stat, relic.mainStat.value) }}
      </p>

      <div class="mt-2">
        <strong>Substats:</strong>
        <ul class="list-none list-inside mt-1 mb-4">
          <li
            v-for="(s, i) in substatRollPreview"
            :key="`${s.stat}-${i}`"
            class="flex items-center gap-2 text-sm"
          >
            {{ s.stat }}: {{ formatStatValue(s.stat, s.value) }}
            <template v-if="s.rolls">
              <template v-for="(count, tier) in s.rolls" :key="tier">
                <template v-for="i in count" :key="i">
                  <span
                    class="w-4 h-4 rounded"
                    :class="{
                      'bg-stone-100': tier === 'low',
                      'bg-blue-400': tier === 'med',
                      'bg-blue-600': tier === 'high',
                    }"
                  ></span>
                </template>
              </template>
            </template>
          </li>
        </ul>
      </div>
      <button
        class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        @click="addRelic"
        :disabled="relic.name === '' || hasInvalidSubstats || hasInvalidMainStat || !hasSubstats"
      >
        Add Relic
      </button>
      <p v-if="!hasSubstats" class="text-xs text-red-400">Needs at least one substat</p>
      <p v-if="hasInvalidMainStat" class="text-xs text-red-400">Main stat must have a value</p>
      <p v-if="hasInvalidSubstats" class="text-xs text-red-400">All substats must have a value</p>
    </div>
    <div class="w-85 border p-4 rounded bg-stone-800 text-white">
      <h4 class="font-semibold mb-2">All Logged Relics ({{ props.relics.length }})</h4>
      <ul class="max-h-96 overflow-auto space-y-2">
        <li
          v-for="(r, index) in props.relics"
          :key="index"
          class="border-b pb-2 last:border-0 relative p-4 rounded bg-neutral-700"
        >
          <button
            class="absolute top-2 right-2 px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs"
            @click="removeRelic(index)"
          >
            -
          </button>

          <!-- Content -->
          <p class="text-sm"><strong>Piece:</strong> {{ r.name }}</p>
          <p class="text-sm"><strong>Slot:</strong> {{ r.slot }}</p>
          <p class="text-sm">
            <strong>Main Stat:</strong> {{ r.mainStat.stat }}:
            {{ formatStatValue(r.mainStat.stat, r.mainStat.value) }}
          </p>
          <p class="text-sm"><strong>Substats:</strong></p>
          <ul class="list-none list-inside mt-1 mb-4">
            <li
              v-for="(s, subIndex) in r.subStatsName"
              :key="subIndex"
              class="flex items-center gap-2 text-sm"
            >
              <!-- Stat text -->
              {{ s.stat }}: {{ formatStatValue(s.stat, s.value) }}
            </li>
            <li v-if="!r.subStatsName?.length">—</li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.input-field {
  display: block;
  margin: 4px 0 8px;
  padding: 4px 6px;
  width: 100%;
  box-sizing: border-box;
}

.substat-row {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.btn-primary {
  background-color: black;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
}

.btn-secondary {
  background-color: white;
  border: 1px solid gray;
  padding: 4px 12px;
  border-radius: 4px;
}
</style>
