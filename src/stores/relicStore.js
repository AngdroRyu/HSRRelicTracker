import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useRelicStore = defineStore('relics', () => {
  const relics = ref([])

  // Load from localStorage on startup
  const stored = localStorage.getItem('farmedRelics')
  if (stored) relics.value = JSON.parse(stored)

  // Watch for changes and save
  watch(
    relics,
    (newVal) => {
      localStorage.setItem('farmedRelics', JSON.stringify(newVal))
    },
    { deep: true },
  )

  function clearRelics() {
    relics.value = []
  }

  return { relics, clearRelics }
})
