<template>
  <div class="mt-20 lg:mt-32">
    <section class="max-w-3xl">
      <h2 class="text-5xl md:text-7xl font-display font-light leading-tight tracking-tighter mb-8">
        Securely <span class="italic font-normal">whisper</span> to the world.
      </h2>
      <p class="text-xl md:text-2xl font-light text-whisper-black/70 leading-relaxed mb-12 max-w-2xl">
        A sanctuary for your conversations. End-to-end encrypted, minimalist by design, and built for clarity.
      </p>
      
      <div class="flex flex-col sm:flex-row gap-6">
        <button class="px-10 py-4 bg-whisper-black text-whisper-cream rounded-full text-sm uppercase tracking-widest font-semibold hover:bg-whisper-terracotta hover:scale-105 active:scale-95">
          Get Started
        </button>
        <button class="px-10 py-4 border border-whisper-black/20 text-whisper-black rounded-full text-sm uppercase tracking-widest font-semibold hover:border-whisper-black hover:bg-whisper-black/5 active:scale-95">
          Learn More
        </button>
      </div>
    </section>

    <!-- Subtle Accent Element -->
    <div class="mt-32 opacity-20">
      <div class="w-full h-px bg-gradient-to-r from-whisper-black via-whisper-terracotta to-transparent"></div>
    </div>

    <section class="mt-32 grid md:grid-cols-3 gap-16 lg:gap-24">
      <div v-for="(feature, i) in features" :key="i" class="space-y-4">
        <span class="text-whisper-terracotta font-display text-sm font-semibold tracking-tighter">0{{ i + 1 }}</span>
        <h3 class="text-xl font-display font-medium">{{ feature.title }}</h3>
        <p class="text-whisper-black/60 font-light leading-relaxed">
          {{ feature.description }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
const features = [
  {
    title: 'Pure Privacy',
    description: 'Every message is encrypted locally before it ever leaves your device. Only you and your recipient hold the keys.'
  },
  {
    title: 'Minimalist Focus',
    description: 'No noise, no distractions. Just a clean interface designed to help you focus on the people who matter.'
  },
  {
    title: 'Afro-Centric Soul',
    description: 'A design language inspired by the warmth, rhythm, and minimalism of African aesthetics.'
  }
]
</script>
