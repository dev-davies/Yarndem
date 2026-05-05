<template>
  <div class="min-h-screen bg-yarn-bg text-yarn-black font-sans selection:bg-yarn-terracotta selection:text-white">
    <!-- Navigation / Header -->
    <header class="py-8 px-6 md:px-12 lg:px-24">
      <nav class="flex justify-between items-center max-w-7xl mx-auto">
        <NuxtLink to="/" class="text-2xl font-display font-semibold tracking-tight text-yarn-black">YarnDem</NuxtLink>
        <div class="hidden md:flex space-x-12 text-sm uppercase tracking-widest font-medium">
          <NuxtLink to="/login" class="hover:text-yarn-terracotta transition-colors duration-300">Messages</NuxtLink>
          <a href="#" class="hover:text-yarn-terracotta transition-colors duration-300">Contacts</a>
          <a href="#" class="hover:text-yarn-terracotta transition-colors duration-300">Vault</a>
        </div>
      </nav>
    </header>

    <main class="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 pb-20">
      <slot />
    </main>
  </div>
</template>
