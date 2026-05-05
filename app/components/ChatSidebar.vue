<template>
  <div class="h-full flex flex-col bg-yarn-bg overflow-hidden">
    <!-- Header with Search -->
    <div class="p-6 space-y-6 sticky top-0 bg-yarn-bg/80 backdrop-blur-md z-10">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-display font-semibold text-yarn-black tracking-tight">Messages</h1>
        <button class="p-2 hover:bg-yarn-black/5 rounded-xl transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yarn-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      <div class="relative group">
        <span class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg class="h-4 w-4 text-yarn-black/30 group-focus-within:text-yarn-terracotta transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input 
          type="text" 
          placeholder="Search conversations..." 
          class="block w-full pl-11 pr-4 py-3 bg-yarn-surface border border-yarn-border rounded-2xl text-sm placeholder-yarn-black/30 focus:outline-none focus:ring-2 focus:ring-yarn-terracotta/20 focus:border-yarn-terracotta transition-all duration-300"
        />
      </div>
    </div>

    <!-- Contact List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6">
      <div class="space-y-1">
        <div 
          v-for="contact in contacts" 
          :key="contact.id"
          @click="activeContactId = contact.id"
          class="relative flex items-center p-4 rounded-2xl cursor-pointer transition-all duration-300 group"
          :class="[
            activeContactId === contact.id 
              ? 'bg-yarn-surface border-l-4 border-yarn-terracotta shadow-sm shadow-yarn-black/5' 
              : 'hover:bg-yarn-surface/50 border-l-4 border-transparent'
          ]"
        >
          <!-- Avatar -->
          <div class="relative h-12 w-12 rounded-full bg-yarn-stone border border-yarn-border flex items-center justify-center text-yarn-black font-semibold text-sm flex-shrink-0">
            {{ getInitials(contact.name) }}
            <div v-if="contact.online" class="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-yarn-bg rounded-full"></div>
          </div>

          <!-- Content -->
          <div class="ml-4 flex-1 min-w-0">
            <div class="flex justify-between items-baseline">
              <h3 class="text-sm font-bold text-yarn-black truncate">{{ contact.name }}</h3>
              <span class="text-[10px] font-medium text-yarn-black/40 uppercase tracking-tighter">{{ contact.time }}</span>
            </div>
            <p 
              class="text-xs truncate mt-1"
              :class="activeContactId === contact.id ? 'text-yarn-black/60' : 'text-yarn-black/40'"
            >
              {{ contact.lastMessage }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Contact {
  id: number
  name: string
  lastMessage: string
  time: string
  online: boolean
}

const activeContactId = ref(1)

const contacts = ref<Contact[]>([
  {
    id: 1,
    name: 'Amara Okafor',
    lastMessage: 'The encrypted vault is ready for the sync.',
    time: '10:42 AM',
    online: true
  },
  {
    id: 2,
    name: 'Kofi Mensah',
    lastMessage: 'Did you see the new minimalist patterns?',
    time: 'Yesterday',
    online: false
  },
  {
    id: 3,
    name: 'Zainab Balogun',
    lastMessage: 'Let’s meet at the usual spot.',
    time: 'Monday',
    online: true
  },
  {
    id: 4,
    name: 'Tunde Adeyemi',
    lastMessage: 'The session keys have been rotated successfully.',
    time: 'Oct 24',
    online: false
  },
  {
    id: 5,
    name: 'Chinua Achebe',
    lastMessage: 'Things fall apart; the center cannot hold.',
    time: 'Oct 22',
    online: false
  }
])

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-yarn-black/5 rounded-full;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  @apply bg-yarn-black/10;
}
</style>
