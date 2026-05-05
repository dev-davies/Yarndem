<template>
  <div class="min-h-screen bg-whisper-cream text-whisper-black font-sans selection:bg-whisper-terracotta selection:text-white">
    <!-- Navigation / Header (Optional placeholder) -->
    <header class="py-8 px-6 md:px-12 lg:px-24">
      <nav class="flex justify-between items-center max-w-7xl mx-auto">
        <h1 class="text-2xl font-display font-semibold tracking-tight text-whisper-black">WhisperBox</h1>
        <div class="hidden md:flex space-x-12 text-sm uppercase tracking-widest font-medium">
          <a href="#" class="hover:text-whisper-terracotta transition-colors duration-300">Messages</a>
          <a href="#" class="hover:text-whisper-terracotta transition-colors duration-300">Contacts</a>
          <a href="#" class="hover:text-whisper-terracotta transition-colors duration-300">Vault</a>
        </div>
      </nav>
    </header>

    <main class="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 pb-20">
      <NuxtPage />
    </main>

    <!-- Global Nuxt components -->
    <NuxtRouteAnnouncer />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@400;500;600&display=swap');

body {
  @apply bg-whisper-cream antialiased;
  margin: 0;
}

/* Subtle transitions for all interactive elements */
a, button {
  @apply transition-all duration-300 ease-in-out;
}
</style>
