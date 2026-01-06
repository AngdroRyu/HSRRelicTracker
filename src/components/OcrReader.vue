<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import Tesseract from 'tesseract.js'
import RelicParts from '@/data/relicParts.json'
import relicDomains from '@/data/relics.json'
import mainStatsBySlot from '@/assets/data/mainStat.js'
import substatNames from '@/assets/data/substatNames.js'

// --------------------
// Reactive state
// --------------------
const uploadedImage = ref(null) // keeps the uploaded file
const ocrText = ref('')
const progress = ref(0)
const fileInput = ref(null)
const fileInputKey = ref(0)
const domain = ref('')
const setName = ref('')
const slot = ref('')
const props = defineProps(['relics'])
const emit = defineEmits(['update:relics'])

const relic = reactive({
  name: '',
  set: '',
  slot: '',
  domain: '',
  mainStat: { stat: '', value: null },
  subStatsName: [],
  imagePath: '', // optional, for set image
})

const MAX_SUBSTATS = 4

// --------------------
// Computed properties
// --------------------
const sets = computed(() => {
  const d = relicDomains.domains.find((d) => d.name === domain.value)
  return d?.sets || []
})
const allSubStats = computed(() => {
  return Array.from(new Set([...substatNames]))
})

const selectedSet = computed(() => sets.value.find((s) => s.name === setName.value))

// Determine which image to display
const relicImage = computed(() => {
  if (selectedSet.value?.imagePath) {
    return new URL(selectedSet.value.imagePath.replace('./../', '/src/'), import.meta.url).href
  }
  if (uploadedImage.value) return uploadedImage.value
  return ''
})

const slotMainStats = computed(() => {
  const pieces = selectedSet.value?.pieces
  const mainStats = pieces?.[slot.value]?.mainStats?.map((m) => m.stat)
  if (!mainStats || mainStats.length === 0) return mainStatsBySlot[slot.value] || []
  return mainStats
})

const slotSubStats = computed(() => selectedSet.value?.pieces?.[slot.value]?.subStats || [])
const filteredSubStats = computed(() => slotSubStats.value.filter((s) => s !== relic.mainStat.stat))

// --------------------
// File upload & OCR
// --------------------
async function handleFile(ev) {
  const file = ev.target.files[0]
  if (!file) return
  resetForm(false)
  uploadedImage.value = URL.createObjectURL(file)
  ocrText.value = ''
  progress.value = 0

  try {
    const { data } = await Tesseract.recognize(uploadedImage.value, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') progress.value = Math.round(m.progress * 100)
      },
    })
    console.log('OCR Data:', data)
    ocrText.value = cleanOcrText(data.text)
    console.log('Cleaned OCR Text:', ocrText.value)

    // --- Match relic name ---
    const potentialName = extractPotentialName(ocrText.value)
    //console.log('Potential Relic Name:', potentialName)
    if (!/[a-zA-Z]{5,}/.test(potentialName)) {
      console.warn('Rejected OCR name:', potentialName)
      return
    }
    const relicName = matchRelicName(potentialName)
    if (!relicName) return
    //console.log('Matched Relic Name:', relicName)

    // Fill form info
    fillFormFromName(relicName)

    relic.name = relicName
    relic.mainStat.stat = ''
    relic.mainStat.value = null
    relic.subStatsName = []

    // Remove relic name from OCR text
    ocrText.value = ocrText.value.replace(relicName, '').trim()

    await nextTick()

    // --- Extract main stat ---
    const allowedMainStats = slotMainStats.value.length
      ? slotMainStats.value
      : mainStatsBySlot[slot.value] || []

    const mainStatRegex = /([A-Za-z\s]+)\s+([-+]?[\d.]+)/
    const mainMatch = ocrText.value.match(mainStatRegex)
    if (mainMatch) {
      const [fullText, statName, statValue] = mainMatch
      const matchedStat = allowedMainStats.find((s) => statName.includes(s.replace('%', '')))
      if (matchedStat) {
        relic.mainStat.stat = matchedStat
        relic.mainStat.value = parseStatValue(statValue)
        ocrText.value = ocrText.value.replace(fullText, '').trim()
      }
    }

    // --- Extract substats ---
    for (let i = 0; i < MAX_SUBSTATS; i++) {
      const res = extractSubStat(ocrText.value)
      if (!res.stat) break
      relic.subStatsName.push({ stat: res.stat, value: res.value })
      ocrText.value = res.remainingText
    }

    // --- Set domain and image path ---
    const domainObj = relicDomains.domains.find((d) => d.sets.some((s) => s.name === relic.set))
    relic.domain = domainObj?.name || ''
    domain.value = relic.domain
    relic.imagePath = selectedSet.value?.imagePath || ''
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

function extractPotentialName(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Join first two lines to catch cases like:
  // "Watchmaker's Illusory Formal"
  // "Suit (0)"
  return lines.slice(0, 2).join(' ')
}

function matchRelicName(text) {
  if (!text || text.length < 8) return ''

  const normalized = text.toLowerCase()

  let bestMatch = ''
  let bestScore = 0

  for (const name of Object.keys(RelicParts)) {
    const words = name.toLowerCase().split(/\s+/)
    let score = 0

    for (const w of words) {
      if (normalized.includes(w)) score++
    }

    // require at least half the words to match
    if (score >= Math.ceil(words.length / 2) && score > bestScore) {
      bestScore = score
      bestMatch = name
    }
  }

  return bestMatch
}

function fillFormFromName(relicName) {
  const info = RelicParts[relicName]
  if (!info) return

  relic.set = info.set
  relic.slot = info.slot
  setName.value = info.set

  const slotKeyMap = {
    Head: 'Head',
    Body: 'Body',
    Hands: 'Hands',
    Hand: 'Hands',
    Feet: 'Feet',
    'Planar Sphere': 'Planar Sphere',
    'Link Rope': 'Link Rope',
  }
  slot.value = slotKeyMap[info.slot] || info.slot

  const domainObj = relicDomains.domains.find((d) => d.sets.some((s) => s.name === relic.set))
  relic.domain = domainObj?.name || ''
  domain.value = relic.domain
}

function extractSubStat(text) {
  text = text.replace(/\s+/g, ' ')
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

  return raw.includes('.') ? value : Math.trunc(value)
}

function resetForm(clearImage = true) {
  domain.value = ''
  setName.value = ''
  slot.value = ''
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

  const updatedRelics = [...props.relics, newRelic]

  emit('update:relics', updatedRelics)

  resetForm()
  fileInputKey.value += 1 // reset file input

  // console.log('Relic added:', newRelic)
  // console.log('Updated relics list:', updatedRelics)
}
</script>

<template>
  <div class="flex items-start justify-center gap-6 p-6">
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
        <button @click="resetForm" class="flex-1 px-4 py-2 rounded bg-gray-600 hover:bg-gray-500">
          Clear
        </button>
      </div>
      <input
        type="file"
        ref="fileInput"
        :key="fileInputKey"
        class="hidden"
        @change="handleFile"
        accept="image/*"
      />

      <!-- OCR Progress -->
      <div v-if="progress > 0" class="w-full bg-gray-700 rounded h-4 overflow-hidden mt-2">
        <div class="bg-blue-600 h-4" :style="{ width: progress + '%' }"></div>
      </div>

      <!-- Domain -->
      <select v-model="domain" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Domain</option>
        <option v-for="d in relicDomains.domains || []" :key="d.name" :value="d.name">
          {{ d.name }}
        </option>
      </select>

      <!-- Set -->
      <select v-model="setName" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Set</option>
        <option v-for="s in sets || []" :key="s.name" :value="s.name">
          {{ s.name }}
        </option>
      </select>

      <!-- Slot -->
      <select v-model="slot" class="border p-2 rounded w-full bg-stone-800 text-white">
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
          <li v-for="s in relic.subStatsName || []" :key="s.stat">
            {{ s.stat }}: {{ formatStatValue(s.stat, s.value) }}
          </li>
          <li v-if="!relic.subStatsName?.length">—</li>
        </ul>
      </div>
      <button
        class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
        @click="addRelic"
        :disabled="relic.name == ''"
      >
        Add Relic
      </button>
    </div>
    <div class="w-85 border p-4 rounded bg-stone-800 text-white">
      <h4 class="font-semibold mb-2">All Logged Relics ({{ props.relics.length }})</h4>
      <ul class="max-h-96 overflow-auto space-y-2">
        <li
          v-for="(r, index) in props.relics"
          :key="index"
          class="border-b pb-2 last:border-0 relative p-4 rounded bg-neutral-700"
        >
          <!-- X Button -->
          <button
            class="absolute top-2 right-2 px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs"
            @click="props.relics.splice(index, 1)"
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
          <ul class="list-disc list-inside ml-4">
            <li v-for="(s, subIndex) in r.subStatsName" :key="subIndex" class="text-sm">
              {{ s.stat }}: {{ formatStatValue(s.stat, s.value) }}
            </li>
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
