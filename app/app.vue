<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <NuxtRouteAnnouncer />
  </div>
</template>

<script setup lang="ts">
const { accessToken, currentUser, fetchMe } = useAuth()

if (accessToken.value && !currentUser.value) {
  await useAsyncData('auth:rehydrate', () => fetchMe())
}
</script>

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
