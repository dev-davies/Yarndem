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
      <MessageWindow />
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
