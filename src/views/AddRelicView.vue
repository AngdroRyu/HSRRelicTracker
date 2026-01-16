<template>
  <div class="p-4 h-full w-full bg-stone-900 text-white flex flex-col min-h-screen">
    <h1 class="text-2xl font-bold mb-4">Add a New Relic</h1>
    <OcrReader v-model:relics="store.relics" />
    <ExportPanel v-model:relics="store.relics" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ExportPanel from '@/components/ExportPanel.vue'
import OcrReader from '@/components/OcrReader.vue'
import { useRelicStore } from '@/stores/relicStore'
const store = useRelicStore()
</script>
