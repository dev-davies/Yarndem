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
          class="max-w-[75%] shadow-sm"
          :class="[
            message.sent 
              ? 'bg-yarn-black text-white rounded-2xl rounded-br-none' 
              : 'bg-yarn-surface text-yarn-black border border-yarn-border rounded-2xl rounded-bl-none',
            message.type === 'image' ? 'p-1' : 'px-5 py-4'
          ]"
        >
          <!-- Text Content -->
          <p v-if="message.text" class="text-sm leading-relaxed" :class="{ 'px-4 py-3': message.type === 'image' }">
            {{ message.text }}
          </p>

          <!-- Image Content -->
          <div v-if="message.type === 'image'" class="relative">
            <img 
              :src="message.mediaUrl" 
              alt="Sent image" 
              class="rounded-xl w-full h-auto object-cover max-h-64"
            />
          </div>

          <!-- File Content -->
          <div v-if="message.type === 'file'" class="flex items-center space-x-4 p-2 rounded-xl" :class="message.sent ? 'bg-white/10' : 'bg-yarn-bg'">
            <div class="p-3 bg-yarn-terracotta rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-bold truncate">{{ message.fileName }}</p>
              <p class="text-[10px] uppercase tracking-widest opacity-60">{{ message.fileSize }}</p>
            </div>
            <button class="p-2 hover:opacity-70 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>

          <div 
            class="mt-2 text-[9px] uppercase tracking-tighter opacity-50"
            :class="[
              message.sent ? 'text-right' : 'text-left',
              message.type === 'image' ? 'px-4 pb-3' : ''
            ]"
          >
            {{ message.time }}
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <footer class="p-6 border-t border-yarn-border bg-yarn-surface">
      <form @submit.prevent="sendMessage" class="flex items-center space-x-4 max-w-5xl mx-auto">
        <!-- Attachment Button -->
        <button 
          type="button"
          class="p-4 text-yarn-black/40 hover:text-yarn-black transition-colors duration-300"
          title="Attach file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

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
  text?: string
  time: string
  sent: boolean
  type: 'text' | 'image' | 'file'
  mediaUrl?: string
  fileName?: string
  fileSize?: string
}

const newMessage = ref('')
const messages = ref<Message[]>([
  {
    id: 1,
    type: 'text',
    text: "Peace be unto you, Amara. Have you verified the new session keys?",
    time: "10:40 AM",
    sent: true
  },
  {
    id: 2,
    type: 'text',
    text: "Verified and locked. The vault sync is complete.",
    time: "10:42 AM",
    sent: false
  },
  {
    id: 3,
    type: 'image',
    text: "Here is the architectural pattern I was talking about.",
    mediaUrl: "https://picsum.photos/600/400",
    time: "10:43 AM",
    sent: true
  },
  {
    id: 4,
    type: 'file',
    fileName: "Project_Brief.pdf",
    fileSize: "2.4 MB",
    time: "10:45 AM",
    sent: false
  },
  {
    id: 5,
    type: 'text',
    text: "Excellent. The minimalist interface really helps focus. Let's keep it secure.",
    time: "10:46 AM",
    sent: true
  }
])

const sendMessage = () => {
  if (!newMessage.value.trim()) return
  
  messages.value.push({
    id: Date.now(),
    type: 'text',
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

img {
  display: block;
}
</style>
