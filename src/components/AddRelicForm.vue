<template>
  <div class="flex items-start justify-center gap-6 p-6">
    <!-- Form -->
    <div class="p-4 border rounded-md max-w-md space-y-4 bg-stone-800 text-white w-full">
      <h3 class="text-lg font-semibold">Add Relic</h3>

      <!-- Domain -->
      <select v-model="domain" class="border p-2 rounded w-full bg-stone-800 text-white">
        <option value="">Select Domain</option>
        <option v-for="d in relicDomains" :key="d.name" :value="d.name">{{ d.name }}</option>
      </select>

      <!-- Set (disabled until domain chosen) -->
      <select
        v-model="setName"
        :disabled="!domain"
        class="border p-2 rounded w-full bg-stone-800 text-white disabled:opacity-60"
      >
        <option value="">Select Set</option>
        <option v-for="s in sets" :key="s.name" :value="s.name">{{ s.name }}</option>
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
            <div v-if="selectedSubStats.includes(stat)" class="flex gap-1">
              <button
                v-for="value in substatOptions[stat]"
                :key="value"
                @click="subStatValues[stat] = value"
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
          class="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500"
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
    <div class="w-80 border p-4 rounded bg-neutral-800 text-white">
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
            X
          </button>

          <!-- Content -->
          <p class="text-sm"><strong>Date:</strong> {{ r.date }}</p>
          <p class="text-sm"><strong>Domain:</strong> {{ r.domain }}</p>
          <p class="text-sm"><strong>Set:</strong> {{ r.set }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import relicData from '../data/relics.json'

// ---------------- Types ----------------
type MainStatEntry = { stat: string; rate?: number }
type Piece = { mainStats: MainStatEntry[]; subStats: string[] }
type RelicSet = { name: string; dropRate?: number; pieces: Record<string, Piece> }
type Domain = { name: string; sets: RelicSet[] }
type RelicData = { domains: Domain[] }

type LoggedSubStat = { stat: string; value: number | string | null }
type LoggedRelic = {
  date: string
  domain: string
  set: string
  slot: string
  mainStat: string
  subStats: LoggedSubStat[]
}

// ---------------- State ----------------
const relicDomains = (relicData as RelicData).domains || []

const domain = ref<string>('')
const setName = ref<string>('')
const slot = ref<string>('')
const mainStat = ref<string>('')

const selectedSubStats = ref<string[]>([])
const subStatValues = ref<Record<string, string | number | null>>({})

const MAX_SUBSTATS = 4
const slots = ['Head', 'Body', 'Hands', 'Feet']
const props = defineProps<{ relics: LoggedRelic[] }>()
const emit = defineEmits<{ (e: 'update:relics', value: LoggedRelic[]): void }>()
const substatOptions: Record<string, (string | number)[]> = {
  HP: [10, 15, 20],
  'HP%': ['5%', '8%', '12%'],
  ATK: [10, 15, 20],
  'ATK%': ['5%', '8%', '12%'],
  DEF: [10, 15, 20],
  'DEF%': ['5%', '8%', '12%'],
  'Crit Rate': ['3%', '5%', '7%'],
  'Crit DMG': ['6%', '9%', '12%'],
  'Break effect': ['3%', '5%', '7%'],
  'Effect Hit Rate': ['3%', '5%', '7%'],
  'Effect RES': ['3%', '5%', '7%'],
}

// ---------------- Computeds ----------------
const selectedDomain = computed(() => relicDomains.find((d) => d.name === domain.value))
const sets = computed(() => selectedDomain.value?.sets || [])
const selectedSet = computed(() => sets.value.find((s) => s.name === setName.value))

const slotMainStats = computed(
  () => selectedSet.value?.pieces?.[slot.value]?.mainStats?.map((m) => m.stat) || [],
)
const slotSubStats = computed(() => selectedSet.value?.pieces?.[slot.value]?.subStats || [])

// exclude mainStat from substat choices
const filteredSubStats = computed(() => slotSubStats.value.filter((s) => s !== mainStat.value))

// currentRelic preview (always in sync with v-models)
const currentRelic = computed(() => ({
  date: new Date().toISOString(),
  domain: domain.value,
  set: setName.value,
  slot: slot.value,
  mainStat: mainStat.value,
  subStats: selectedSubStats.value.map((stat) => ({
    stat,
    value: subStatValues.value[stat] ?? null,
  })),
}))

// ---------------- Watches / Reactivity ----------------

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

// ---------------- Methods ----------------
function handleSubmit() {
  if (!domain.value || !setName.value || !slot.value || !mainStat.value) return

  const toAdd: LoggedRelic = {
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
