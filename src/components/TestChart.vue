<script setup>
import { Pie } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { reactive } from 'vue'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, ArcElement)

// Chart data — must exist immediately
const data = reactive({
  labels: ['Attack', 'Defense', 'HP'],
  datasets: [
    {
      label: 'Example Stats',
      data: [10, 5, 15],
      backgroundColor: ['#f87171', '#60a5fa', '#34d399'],
    },
  ],
})

// Chart options
const options = {
  responsive: true,
  plugins: {
    legend: { position: 'right' },
    title: { display: true, text: 'Minimal Pie Chart' },
  },
}
</script>

<template>
  <div class="p-4 w-full h-[80vh] bg-stone-800 text-white rounded">
    <h2 class="text-xl font-bold mb-4">Minimal Chart Test</h2>
    <!-- note the prop names now match vue-chartjs v5+ -->
    <Pie :data="data" :options="options" />
  </div>
</template>
