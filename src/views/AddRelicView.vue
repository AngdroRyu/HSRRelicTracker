<template>
  <div class="p-4 h-full w-full bg-stone-900 text-white">
    <h1 class="text-2xl font-bold mb-4">Add a New Relic</h1>
    <OcrReader v-model:relics="farmedRelics" />
    <ExportPanel :relics="farmedRelics" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ExportPanel from '@/components/ExportPanel.vue'
import OcrReader from '@/components/OcrReader.vue'

// Reactive array to store all added relics
const farmedRelics = ref([])
</script>
