<template>
  <div class="min-h-screen bg-stone-800 text-white flex flex-col items-center justify-center p-6">
    <h1 class="text-4xl font-bold mb-6">Welcome to HSR Relic Tracker</h1>
    <router-link
      to="/add-relic"
      class="px-6 py-3 bg-blue-600 rounded hover:bg-blue-500 transition text-lg"
    >
      Add a Relic
    </router-link>
    <p class="mt-4 text-gray-300 text-center max-w-md">Track and manage your relics efficiently.</p>
  </div>
</template>

<script setup></script>
