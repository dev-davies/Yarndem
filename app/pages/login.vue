<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8 bg-yarn-cream/50 p-8 md:p-12 rounded-3xl border border-yarn-black/5 shadow-2xl shadow-yarn-black/5 backdrop-blur-sm">
      <div class="text-center">
        <!-- Lock Icon -->
        <div class="mx-auto h-16 w-16 bg-yarn-black flex items-center justify-center rounded-2xl mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-yarn-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="text-3xl font-display font-medium text-yarn-black tracking-tight">Welcome back</h2>
        <p class="mt-3 text-sm text-yarn-black/50 font-light">
          Access your secure YarnDem vault
        </p>
      </div>

      <form class="mt-10 space-y-6" @submit.prevent="handleLogin">
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-xs font-semibold uppercase tracking-widest text-yarn-black/40 mb-2 ml-1">Username</label>
            <input 
              id="username" 
              v-model="username"
              name="username" 
              type="text" 
              required 
              class="appearance-none relative block w-full px-4 py-4 border border-yarn-black/10 placeholder-yarn-black/30 text-yarn-black bg-yarn-cream/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yarn-terracotta/20 focus:border-yarn-terracotta transition-all duration-300 sm:text-sm" 
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label for="password" class="block text-xs font-semibold uppercase tracking-widest text-yarn-black/40 mb-2 ml-1">Password</label>
            <input 
              id="password" 
              v-model="password"
              name="password" 
              type="password" 
              required 
              class="appearance-none relative block w-full px-4 py-4 border border-yarn-black/10 placeholder-yarn-black/30 text-yarn-black bg-yarn-cream/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yarn-terracotta/20 focus:border-yarn-terracotta transition-all duration-300 sm:text-sm" 
              placeholder="••••••••"
            />
          </div>
        </div>

        <div class="pt-4">
          <button 
            type="submit" 
            class="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-semibold uppercase tracking-widest rounded-full text-yarn-cream bg-yarn-black hover:bg-yarn-terracotta focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yarn-terracotta transform transition-all duration-300 active:scale-95"
          >
            Generate Keys & Login
          </button>
        </div>

        <div class="text-center space-y-4">
          <div class="flex items-center justify-center space-x-2 opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-yarn-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-[10px] uppercase tracking-widest font-medium text-yarn-black/60">
              Keys are generated locally on your device.
            </p>
          </div>
          <p class="text-xs text-yarn-black/40">
            New here? <a href="#" class="text-yarn-terracotta font-medium hover:underline">Request an invite</a>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')

const handleLogin = () => {
  // Authentication and key generation logic will go here
  console.log('Generating keys for:', username.value)
  
  // Navigate to home page as requested
  router.push('/')
}

definePageMeta({
  layout: 'default'
})
</script>

<style scoped>
/* Custom shadow for the card to give it depth without being heavy */
.shadow-2xl {
  box-shadow: 0 25px 50px -12px rgba(18, 18, 18, 0.05);
}

input::placeholder {
  @apply opacity-50;
}
</style>
