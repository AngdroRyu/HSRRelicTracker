<script setup>
import { Pie } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { computed, ref } from 'vue'
import { useRelicStore } from '@/stores/relicStore'
import mainStatsBySlot from '@/assets/data/mainStat.js'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, ArcElement, ChartDataLabels)

// Pinia store
const relicStore = useRelicStore()

// Slot filter
const selectedSlot = ref('All')

// Define consistent colors for stats
const statColors = {
  ATK: '#f87171',
  'ATK%': '#fca5a5',
  HP: '#60a5fa',
  'HP%': '#93c5fd',
  DEF: '#34d399',
  'DEF%': '#6ee7b7',
  'CRIT Rate': '#fbbf24',
  'CRIT DMG': '#fde68a',
  Speed: '#a78bfa',
  'Effect Hit Rate': '#c4b5fd',
  'Break Effect': '#f472b6',
  'Energy Regeneration Rate': '#f9a8d4',
  'Physical DMG Boost': '#fb923c',
  'Fire DMG Boost': '#fcd34d',
  'Ice DMG Boost': '#60a5fa',
  'Wind DMG Boost': '#34d399',
  'Lightning DMG Boost': '#818cf8',
  'Quantum DMG Boost': '#a78bfa',
  'Imaginary DMG Boost': '#c084fc',
  'Outgoing Healing': '#22d3ee',
}

// Compute labels based on selected slot
const chartLabels = computed(() => {
  if (selectedSlot.value === 'All') {
    const allStats = Object.values(mainStatsBySlot).flat()
    return [...new Set(allStats)]
  }
  return mainStatsBySlot[selectedSlot.value] || []
})

// Compute chart data
const chartData = computed(() => {
  const labels = chartLabels.value

  if (!labels.length) {
    return { labels: [], datasets: [{ label: 'Relics', data: [], backgroundColor: [] }] }
  }

  // Count relics per stat
  const counts = labels.map((stat) => {
    return relicStore.relics.filter(
      (r) =>
        (!selectedSlot.value || selectedSlot.value === 'All' || r.slot === selectedSlot.value) &&
        r.mainStat?.stat === stat,
    ).length
  })

  // Filter out zeros
  const filtered = labels
    .map((label, idx) => ({ label, count: counts[idx] }))
    .filter((item) => item.count > 0)

  const total = filtered.reduce((sum, item) => sum + item.count, 0)
  const filteredLabels = filtered.map((item) => item.label)
  const filteredCounts = filtered.map((item) => item.count)

  return {
    labels: filteredLabels,
    datasets: [
      {
        label: 'Relics by Main Stat',
        data: filteredCounts,
        backgroundColor: filteredLabels.map((stat) => statColors[stat] || '#888'),
      },
    ],
  }
})

// Chart options with percentages
const chartOptions = {
  responsive: true,
  plugins: {
    legend: { position: 'right' },
    title: { display: true, text: 'Relic Stats' },
    datalabels: {
      formatter: (value, ctx) => {
        const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0)
        const percentage = total ? ((value / total) * 100).toFixed(1) : 0
        return percentage + '%'
      },
      color: 'white',
      font: { weight: 'bold' },
    },
  },
}
</script>

<template>
  <div class="w-[700px] max-w-screen-xl mx-auto bg-stone-800 p-4 rounded">
    <h2 class="text-lg font-semibold mb-2">Relic Stats Pie Chart</h2>

    <!-- Slot filter -->
    <label class="block mb-2">
      <span>Filter by Slot:</span>
      <select v-model="selectedSlot" class="mt-1 block w-full bg-stone-700 text-white rounded p-1">
        <option>All</option>
        <option v-for="slot in Object.keys(mainStatsBySlot)" :key="slot">{{ slot }}</option>
      </select>
    </label>

    <Pie :data="chartData" :options="chartOptions" />
  </div>
</template>
