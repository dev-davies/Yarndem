<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <NuxtRouteAnnouncer />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@400;500;600&display=swap');

body {
  @apply bg-yarn-cream antialiased;
  margin: 0;
}

/* Subtle transitions for all interactive elements */
a, button {
  @apply transition-all duration-300 ease-in-out;
}
</style>
