<script setup lang="ts">
const props = defineProps<{ json: string }>()
function copyToClipboard() {
  navigator.clipboard.writeText(props.json)
  console.log(props.json)
}
</script>

<template>
  <div class="p-4 border rounded bg-gray-900 text-white">
    <h4 class="font-semibold mb-2">Export Relics</h4>
    <pre class="text-xs max-h-64 overflow-auto">{{ json }}</pre>
    <button @click="copyToClipboard" class="mt-2 px-3 py-1 bg-green-600 rounded">Copy JSON</button>
  </div>
</template>
