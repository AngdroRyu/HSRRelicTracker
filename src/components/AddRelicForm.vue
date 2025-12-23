<template>
  <div class="flex items-start justify-center gap-6 p-6">
    <!-- Form -->
    <div class="p-4 border rounded-md max-w-md space-y-4 bg-stone-800 text-white w-full">
      <h3 class="text-lg font-semibold">Add Relic</h3>

      <!-- Domain -->
      <select v-model="domain" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Domain</option>
        <option v-for="d in relicDomains" :key="d.name" :value="d.name">
          {{ d.name }}
        </option>
      </select>

      <!-- Set -->
      <select v-model="setName" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Set</option>
        <option v-for="s in sets" :key="s.name" :value="s.name">
          {{ s.name }}
        </option>
      </select>

      <!-- Slot -->
      <select v-model="slot" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Slot</option>
        <option v-for="s in slots" :key="s" :value="s">{{ s }}</option>
      </select>

      <!-- Main Stat -->
      <select
        v-if="slotMainStats.length > 0"
        v-model="mainStat"
        class="border p-2 rounded w-full bg-stone-800 text-white"
        :disabled="slotMainStats.length <= 1"
      >
        <option value="">Select Main Stat</option>
        <option v-for="ms in slotMainStats" :key="ms" :value="ms">{{ ms }}</option>
      </select>

      <!-- Substats (checkbox + ) -->
      <div>
        <label class="block mb-2">Substats (max {{ MAX_SUBSTATS }})</label>
        <div class="space-y-2">
          <div v-for="stat in filteredSubStats" :key="stat" class="flex items-center space-x-3">
            <!-- Checkbox to select substat -->
            <input
              type="checkbox"
              :value="stat"
              v-model="selectedSubStats"
              :disabled="
                !selectedSubStats.includes(stat) && selectedSubStats.length >= MAX_SUBSTATS
              "
              class="h-4 w-4"
            />
            <span class="flex-1">{{ stat }}</span>

            <!-- Fixed-value buttons, only show if substat is selected -->
            <div class="flex gap-1">
              <button
                v-for="value in substatOptions[stat]"
                :key="value"
                @click="subStatValues[stat] = value"
                :disabled="
                  !selectedSubStats.includes(stat) && selectedSubStats.length >= MAX_SUBSTATS
                "
                :class="{
                  'bg-blue-600 text-white': subStatValues[stat] === value,
                  'bg-gray-600 text-white': subStatValues[stat] !== value,
                }"
                class="px-2 py-1 rounded"
              >
                {{ value }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          @click="handleSubmit"
          :disabled="!canSubmit"
          class="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          Add Relic
        </button>
        <button @click="resetForm" class="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500">
          Reset
        </button>
      </div>
    </div>

    <!-- Preview / Export -->
    <div class="w-80 border p-4 rounded bg-neutral-800 text-white">
      <h4 class="font-semibold mb-2">Current Relic Preview</h4>
      <div class="mb-4 flex justify-center bg-neutral-700/80 p-2 rounded">
        <img v-if="imageSrc" :src="imageSrc" :alt="selectedSet?.name || 'Relic Image'" />
      </div>

      <p><strong>Piece:</strong>{{ currentRelic.piece }}</p>
      <p><strong>Domain:</strong> {{ currentRelic.domain || '—' }}</p>
      <p><strong>Set:</strong> {{ currentRelic.set || '—' }}</p>
      <p><strong>Slot:</strong> {{ currentRelic.slot || '—' }}</p>
      <p><strong>Main Stat:</strong> {{ currentRelic.mainStat || '—' }}</p>

      <div class="mt-2">
        <strong>Substats:</strong>
        <ul class="list-none list-inside mt-1">
          <li v-for="s in currentRelic.subStats" :key="s.stat">
            {{ s.stat }}: {{ s.value ?? '—' }}
          </li>
          <li v-if="!currentRelic.subStats.length">—</li>
        </ul>
      </div>
    </div>
    <div class="w-80 border p-4 rounded bg-stone-800 text-white">
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
          <p class="text-sm"><strong>Date:</strong> {{ r.date }}</p>
          <p class="text-sm"><strong>Set:</strong> {{ r.set }}</p>
          <p class="text-sm"><strong>Slot:</strong> {{ r.slot }}</p>
          <p class="text-sm"><strong>Main Stat:</strong> {{ r.mainStat }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import relicData from '../data/relics.json'
import substatOptions from '@/assets/data/substatValues.js'
import relicParts from '@/data/relicParts.json'

// ---------------- State ----------------
const relicDomains = relicData.domains || []
const domain = ref('')
const setName = ref('')
const slot = ref('')
const mainStat = ref('')

const selectedSubStats = ref([])
const subStatValues = ref({})

const MAX_SUBSTATS = 4
const props = defineProps(['relics'])
const emit = defineEmits(['update:relics'])

// ---------------- Computeds ----------------
const selectedDomain = computed(() => relicDomains.find((d) => d.name === domain.value))
const allSets = computed(() =>
  relicDomains
    .flatMap((domain) =>
      domain.sets.map((set) => ({
        domain: domain.name,
        name: set.name,
      })),
    )
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const imageSrc = computed(() =>
  selectedSet.value?.imagePath ? new URL(selectedSet.value.imagePath, import.meta.url).href : '',
)

const slots = computed(() => (selectedSet.value ? Object.keys(selectedSet.value.pieces) : []))

const sets = computed(() => {
  if (!domain.value)
    return relicDomains.flatMap((d) => d.sets).sort((a, b) => a.name.localeCompare(b.name)) // all sets if no domain picked
  const foundDomain = relicDomains.find((d) => d.name === domain.value)
  return foundDomain?.sets || []
})
const selectedSet = computed(() => sets.value.find((s) => s.name === setName.value))

const slotMainStats = computed(
  () => selectedSet.value?.pieces?.[slot.value]?.mainStats?.map((m) => m.stat) || [],
)
const slotSubStats = computed(() => selectedSet.value?.pieces?.[slot.value]?.subStats || [])

// exclude mainStat from substat choices
const filteredSubStats = computed(() => slotSubStats.value.filter((s) => s !== mainStat.value))

const canSubmit = computed(() => {
  return (
    domain.value &&
    setName.value &&
    slot.value &&
    mainStat.value &&
    selectedSubStats.value.length > 2 &&
    selectedSubStats.value.every(
      (stat) => subStatValues.value[stat] !== undefined && subStatValues.value[stat] !== null,
    )
  )
})

// currentRelic preview (always in sync with v-models)
const currentRelic = computed(() => ({
  date: new Date().toISOString(),
  domain: domain.value,
  set: setName.value,
  slot: slot.value,
  piece: slot.value,
  mainStat: mainStat.value,
  subStats: selectedSubStats.value.map((stat) => ({
    stat,
    value: subStatValues.value[stat] ?? null,
  })),
}))

// ---------------- Watches / Reactivity ----------------
// if domain changes, clear set if no longer valid
watch(domain, (newDomain, oldDomain) => {
  if (!newDomain) {
    setName.value = '' // clear set if domain reset
    return
  }

  // if the currently chosen set is not in the new domain → clear it
  const domainSets = relicDomains.find((d) => d.name === newDomain)?.sets || []
  const stillValid = domainSets.some((s) => s.name === setName.value)

  if (!stillValid) {
    setName.value = ''
  }
})
// if set changes, update domain (in case user manually changed set without changing domain)
watch(setName, (newSet) => {
  if (!newSet) return
  const found = allSets.value.find((s) => s.name === newSet)
  if (found) {
    domain.value = found.domain
  }
})

watch(slots, (newSlots) => {
  if (!newSlots.includes(slot.value)) {
    slot.value = '' // reset if the previous slot is no longer valid
  }
})

// if mainStat changes, remove it from selected substats (if present)
watch(mainStat, (newVal) => {
  if (!newVal) return
  if (selectedSubStats.value.includes(newVal)) {
    selectedSubStats.value = selectedSubStats.value.filter((s) => s !== newVal)
    delete subStatValues.value[newVal]
  }
})

// when slot or setName changes, clear main/sub selections because available stats may differ
watch([slot, setName], () => {
  mainStat.value = ''
  selectedSubStats.value = []
  subStatValues.value = {}
})

// when selectedSubStats changes, clear values for removed stats
watch(selectedSubStats, (newArr, oldArr) => {
  const removed = oldArr.filter((x) => !newArr.includes(x))
  for (const r of removed) {
    delete subStatValues.value[r]
  }
})
watch(slotMainStats, (newStats) => {
  if (newStats.length === 1) {
    mainStat.value = newStats[0]
  } else {
    mainStat.value = '' // reset if multiple options
  }
})

watch(
  subStatValues,
  (newVal, oldVal) => {
    for (const stat of Object.keys(newVal)) {
      const val = newVal[stat]
      // If a substat now has a value, ensure it's selected
      if (val != null && !selectedSubStats.value.includes(stat)) {
        selectedSubStats.value.push(stat)
      }
      // If a substat value is cleared, remove from selectedSubStats
      if ((val === null || val === '') && selectedSubStats.value.includes(stat)) {
        selectedSubStats.value = selectedSubStats.value.filter((s) => s !== stat)
      }
    }
  },
  { deep: true },
)

// ---------------- Methods ----------------
function handleSubmit() {
  if (!domain.value || !setName.value || !slot.value || !mainStat.value) return

  const toAdd = {
    date: new Date().toISOString().split('T')[0],
    domain: domain.value,
    set: setName.value,
    slot: slot.value,
    mainStat: mainStat.value,
    subStats: selectedSubStats.value.map((stat) => ({
      stat,
      value: subStatValues.value[stat] ?? null,
    })),
  }

  // Push to parent via v-model
  props.relics.push(toAdd)
  emit('update:relics', props.relics)

  // Reset form fields except domain and setName
  slot.value = ''
  mainStat.value = ''
  selectedSubStats.value = []
  subStatValues.value = {}
}
function fillRelicFromName(relicName) {
  const info = relicParts[relicName]
  if (!info) return

  const { set: setNameFromPart, slot: slotFromPart } = info

  // Find the set in relicDomains
  const domainObj = relicDomains.find((d) => d.sets.some((s) => s.name === setNameFromPart))
  if (!domainObj) return

  const setObj = domainObj.sets.find((s) => s.name === setNameFromPart)
  if (!setObj) return

  const piece = setObj.pieces[slotFromPart]
  if (!piece) return

  // Fill form fields
  domain.value = domainObj.name
  setName.value = setNameFromPart
  slot.value = slotFromPart

  // If only 1 main stat option, auto-fill
  if (piece.mainStats.length === 1) {
    mainStat.value = piece.mainStats[0].stat
  } else {
    mainStat.value = ''
  }

  // Clear substats selections
  selectedSubStats.value = []
  subStatValues.value = {}

  // Optionally pre-fill allowed substats (for display/filtering)
  // slotSubStats is computed from set + slot automatically
}

// reset entire form
function resetForm() {
  domain.value = ''
  setName.value = ''
  slot.value = ''
  mainStat.value = ''
  selectedSubStats.value = []
  subStatValues.value = {}
}
</script>

<style scoped>
/* Remove number spinners */
.no-spinner::-webkit-inner-spin-button,
.no-spinner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spinner {
  -moz-appearance: textfield;
}

/* small style tweak to match disabled look */
select:disabled {
  opacity: 0.65;
}
</style>
