<template>
  <nav
    class="bg-stone-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md"
  >
    <div class="font-bold text-xl">HSR Relic Tracker</div>
    <div class="space-x-4">
      <router-link to="/" class="hover:text-blue-400 transition">Home</router-link>
      <router-link to="/add-relic" class="hover:text-blue-400 transition">Add Relic</router-link>
      <router-link to="/tracker" class="hover:text-blue-400 transition">Tracker</router-link>
    </div>
  </nav>
</template>

<script setup></script>
