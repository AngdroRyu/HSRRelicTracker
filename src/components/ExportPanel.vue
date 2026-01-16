<script setup>
import { computed } from 'vue'

const props = defineProps(['relics'])
const emit = defineEmits(['update:relics'])

// Fallback to an empty array if props.relics is undefined
const relics = computed(() => props.relics ?? [])

// Total relics
const totalCurrent = computed(() => relics.value.length)

// --------------------
// JSON Import
// --------------------
function handleImport(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const fileText = e.target?.result
      if (!fileText) return

      let parsed = JSON.parse(fileText)

      // Accept either array or { relics: [...] }
      if (!Array.isArray(parsed)) {
        if (parsed.relics && Array.isArray(parsed.relics)) {
          parsed = parsed.relics
        } else {
          console.error('JSON must be an array or { "relics": [...] }')
          return
        }
      }

      // Merge into parent relics via emit
      emit('update:relics', [...(props.relics ?? []), ...parsed])
    } catch (err) {
      console.error('Invalid JSON file:', err)
    }
  }

  reader.readAsText(file)
}

// --------------------
// JSON Export
// --------------------
function handleDownload() {
  const dataStr = JSON.stringify(props.relics ?? [], null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'relics.json'
  a.click()

  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="p-4 bg-stone-800 text-white rounded-lg shadow border border-white w-[50%]">
    <h2 class="text-xl font-bold mb-2">Export Panel</h2>

    <!-- Totals -->
    <p>Total relics: {{ totalCurrent }}</p>

    <!-- Controls -->
    <div class="flex gap-2 mt-3">
      <input
        type="file"
        accept="application/json"
        @change="handleImport"
        class="block bg-neutral-700 rounded text-sm file:bg-blue-600 file:text-white file:px-3 file:py-1 file:rounded file:border-none hover:file:bg-blue-700"
      />
      <button
        @click="handleDownload"
        class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
      >
        Download JSON
      </button>
    </div>

    <!-- JSON Preview -->
    <pre class="mt-4 p-2 bg-stone-900 rounded text-sm overflow-x-auto max-h-80">{{
      JSON.stringify(props.relics ?? [], null, 2)
    }}</pre>
  </div>
</template>
