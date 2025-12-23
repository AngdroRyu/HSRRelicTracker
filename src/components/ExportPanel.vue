<script setup>
import { computed, ref } from 'vue'

const props = defineProps(['relics'])

// ✅ fallback so it's never undefined
const relics = computed(() => props.relics ?? [])

// keep track of imported relics separately
const importedRelics = ref([])

// totals
const totalCurrent = computed(() => relics.value.length)
const totalImported = computed(() => importedRelics.value.length)

// merge preview
const combined = computed(() => [...relics.value, ...importedRelics.value])

// handle JSON file import
function handleImport(event) {
  const input = event.target
  if (!input.files?.length) return

  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target?.result)
      importedRelics.value.push(...parsed)
    } catch (err) {
      console.error('Invalid JSON file:', err)
    }
  }
  reader.readAsText(file)
}

// export combined JSON as file
function handleDownload() {
  const dataStr = JSON.stringify(combined.value, null, 2)
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

    <!-- totals -->
    <p>Current relics: {{ totalCurrent }}</p>
    <p>Imported relics: {{ totalImported }}</p>
    <p class="font-semibold mt-2">Combined total: {{ combined.length }}</p>

    <!-- controls -->
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

    <!-- JSON preview -->
    <pre class="mt-4 p-2 bg-stone-900 rounded text-sm overflow-x-auto max-h-80"
      >{{ JSON.stringify(combined, null, 2) }}
    </pre>
  </div>
</template>
