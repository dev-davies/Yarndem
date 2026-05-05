<template>
  <div class="h-screen w-full flex overflow-hidden bg-yarn-bg font-sans selection:bg-yarn-terracotta selection:text-white">
    <!-- Left Pane: Contacts Sidebar -->
    <aside 
      class="w-full md:w-[30%] md:max-w-[400px] h-full flex flex-col bg-yarn-bg border-r border-yarn-border z-20 transition-all duration-300"
      :class="{ 'hidden md:flex': activeChat }"
    >
      <ChatSidebar />
    </aside>

    <!-- Right Pane: Active Message Window -->
    <main 
      class="flex-1 h-full flex flex-col bg-yarn-surface relative overflow-hidden transition-all duration-300"
      :class="{ 'hidden md:flex': !activeChat, 'flex': activeChat }"
    >
      <div class="p-6 border-b border-yarn-border flex items-center space-x-4 bg-yarn-surface/50 backdrop-blur-md sticky top-0 z-10">
        <button 
          v-if="activeChat" 
          @click="activeChat = false"
          class="md:hidden p-2 -ml-2 hover:bg-yarn-black/5 rounded-full"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yarn-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="h-10 w-10 rounded-full bg-yarn-stone"></div>
        <div>
          <h2 class="text-base font-semibold text-yarn-black">Active Conversation</h2>
          <p class="text-[10px] text-yarn-terracotta uppercase tracking-widest font-bold">Encrypted</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(#C05A3E05_1px,transparent_1px)] [background-size:20px_20px]">
        <!-- Message Placeholder Content -->
        <div class="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p class="font-display italic text-lg text-yarn-black">Select a conversation to start yarnin'</p>
        </div>
      </div>

      <!-- Input Placeholder -->
      <div class="p-6 border-t border-yarn-border bg-yarn-surface">
        <div class="flex items-center space-x-4 max-w-4xl mx-auto">
          <input 
            type="text" 
            placeholder="Type a secure message..." 
            class="flex-1 bg-yarn-bg/50 border border-yarn-border rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-yarn-terracotta/20 focus:border-yarn-terracotta transition-all text-sm"
          />
          <button class="bg-yarn-black text-yarn-cream p-4 rounded-2xl hover:bg-yarn-terracotta transition-all shadow-lg active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeChat = ref(false)

definePageMeta({
  layout: false
})
</script>

<style>
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
