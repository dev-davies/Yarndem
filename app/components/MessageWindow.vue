<template>
  <div class="flex flex-col h-full bg-yarn-bg overflow-hidden">
    <!-- Header -->
    <header class="p-6 border-b border-yarn-border bg-yarn-surface flex justify-between items-center z-10">
      <div class="flex items-center space-x-4">
        <div class="h-12 w-12 rounded-full bg-yarn-stone border border-yarn-border flex items-center justify-center text-yarn-black font-semibold text-sm">
          AO
        </div>
        <div>
          <h2 class="text-base font-bold text-yarn-black">Amara Okafor</h2>
          <p class="text-[10px] text-green-500 font-bold uppercase tracking-widest">Online</p>
        </div>
      </div>

      <div class="flex items-center px-4 py-1.5 bg-yarn-terracotta/10 rounded-full border border-yarn-terracotta/20">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-yarn-terracotta mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span class="text-[10px] font-bold text-yarn-terracotta uppercase tracking-widest">End-to-End Encrypted</span>
      </div>
    </header>

    <!-- Message Area -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(#C05A3E05_1px,transparent_1px)] [background-size:20px_20px]">
      <div v-for="message in messages" :key="message.id" class="flex" :class="message.sent ? 'justify-end' : 'justify-start'">
        <div 
          class="max-w-[75%] px-5 py-4 text-sm leading-relaxed shadow-sm"
          :class="[
            message.sent 
              ? 'bg-yarn-black text-white rounded-2xl rounded-br-none' 
              : 'bg-yarn-surface text-yarn-black border border-yarn-border rounded-2xl rounded-bl-none'
          ]"
        >
          {{ message.text }}
          <div 
            class="mt-2 text-[9px] uppercase tracking-tighter opacity-50"
            :class="message.sent ? 'text-right' : 'text-left'"
          >
            {{ message.time }}
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <footer class="p-6 border-t border-yarn-border bg-yarn-surface">
      <form @submit.prevent="sendMessage" class="flex items-center space-x-4 max-w-5xl mx-auto">
        <div class="flex-1 relative">
          <input 
            type="text" 
            v-model="newMessage"
            placeholder="Type a secure message..." 
            class="w-full bg-yarn-bg border border-yarn-border rounded-full px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-yarn-black/5 focus:border-yarn-black transition-all"
          />
        </div>
        <button 
          type="submit"
          class="p-4 rounded-full text-yarn-black hover:text-yarn-terracotta transition-colors duration-300 transform active:scale-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Message {
  id: number
  text: string
  time: string
  sent: boolean
}

const newMessage = ref('')
const messages = ref<Message[]>([
  {
    id: 1,
    text: "Peace be unto you, Amara. Have you verified the new session keys?",
    time: "10:40 AM",
    sent: true
  },
  {
    id: 2,
    text: "Verified and locked. The vault sync is complete.",
    time: "10:42 AM",
    sent: false
  },
  {
    id: 3,
    text: "Excellent. Remember, no metadata is stored on the relay server.",
    time: "10:43 AM",
    sent: true
  },
  {
    id: 4,
    text: "Understood. The minimalist interface really helps focus on the conversation. I love the warm palette.",
    time: "10:45 AM",
    sent: false
  },
  {
    id: 5,
    text: "It’s all about the yarn, my friend. Let's keep it secure.",
    time: "10:46 AM",
    sent: true
  }
])

const sendMessage = () => {
  if (!newMessage.value.trim()) return
  
  messages.value.push({
    id: Date.now(),
    text: newMessage.value,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sent: true
  })
  
  newMessage.value = ''
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
