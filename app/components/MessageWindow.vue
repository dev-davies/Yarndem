<template>
  <div v-if="!activeContact" class="flex items-center justify-center h-full bg-yarn-bg">
    <div class="text-center px-8 max-w-sm">
      <div class="mx-auto h-16 w-16 bg-yarn-surface border border-yarn-border flex items-center justify-center rounded-2xl mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-yarn-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h2 class="text-lg font-display font-medium text-yarn-black tracking-tight">Select a conversation</h2>
      <p class="text-sm text-yarn-black/50 mt-2">Pick a contact from the sidebar or search for someone new to start chatting securely.</p>
    </div>
  </div>

  <div v-else class="flex flex-col h-full bg-yarn-bg overflow-hidden">
    <!-- Header -->
    <header class="p-6 border-b border-yarn-border bg-yarn-surface flex justify-between items-center z-10">
      <div class="flex items-center space-x-4">
        <div class="h-12 w-12 rounded-full bg-yarn-stone border border-yarn-border flex items-center justify-center text-yarn-black font-semibold text-sm">
          {{ contactInitials }}
        </div>
        <div>
          <h2 class="text-base font-bold text-yarn-black">{{ contactDisplayName }}</h2>
          <p class="text-[10px] text-yarn-black/40 font-bold uppercase tracking-widest">@{{ activeContact.username }}</p>
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
    <div ref="scrollEl" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(#C05A3E05_1px,transparent_1px)] [background-size:20px_20px]">
      <div v-if="isLoadingHistory" class="flex justify-center py-8">
        <span class="text-xs text-yarn-black/40 uppercase tracking-widest">Decrypting messages…</span>
      </div>

      <div v-else-if="messages.length === 0" class="flex justify-center py-12">
        <p class="text-xs text-yarn-black/40 max-w-xs text-center">
          No messages yet. Say something — it'll be end-to-end encrypted before it leaves your device.
        </p>
      </div>

      <div
        v-for="message in messages"
        :key="message.id"
        class="flex"
        :class="message.sentBySelf ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[75%] shadow-sm px-5 py-4"
          :class="[
            message.sentBySelf
              ? 'bg-yarn-black text-white rounded-2xl rounded-br-none'
              : 'bg-yarn-surface text-yarn-black border border-yarn-border rounded-2xl rounded-bl-none',
            message.status === 'failed' ? 'opacity-60 ring-1 ring-red-400/40' : ''
          ]"
        >
          <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ message.text }}</p>

          <div
            class="mt-2 text-[9px] uppercase tracking-tighter opacity-50 flex items-center gap-2"
            :class="message.sentBySelf ? 'justify-end' : 'justify-start'"
          >
            <span>{{ formatTime(message.createdAt) }}</span>
            <span v-if="message.sentBySelf && message.status === 'sent'">• Sent</span>
            <span v-if="message.sentBySelf && message.status === 'failed'" class="text-red-300">• Failed</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <footer class="p-6 border-t border-yarn-border bg-yarn-surface">
      <div v-if="sendError" class="max-w-5xl mx-auto mb-3 text-xs text-red-600 bg-red-50/80 border border-red-300/60 rounded-xl px-4 py-2">
        {{ sendError }}
      </div>

      <form class="flex items-center space-x-4 max-w-5xl mx-auto" @submit.prevent="onSend">
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
            v-model="newMessage"
            type="text"
            :placeholder="canSend ? 'Type a secure message...' : 'Recipient public key missing — cannot send'"
            :disabled="!canSend || isSending"
            class="w-full bg-yarn-bg border border-yarn-border rounded-full px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-yarn-black/5 focus:border-yarn-black transition-all disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          :disabled="!canSend || isSending || !newMessage.trim()"
          class="p-4 rounded-full text-yarn-black hover:text-yarn-terracotta transition-colors duration-300 transform active:scale-90 disabled:opacity-40 disabled:hover:text-yarn-black"
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
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const { activeContact } = useChat()
const { messages, loadHistory, clearMessages, sendMessage, connectWS, disconnectWS } = useMessages()

const newMessage = ref('')
const isSending = ref(false)
const isLoadingHistory = ref(false)
const sendError = ref('')
const scrollEl = ref<HTMLDivElement | null>(null)

const contactDisplayName = computed(() => {
  if (!activeContact.value) return ''
  return activeContact.value.display_name || activeContact.value.username
})

const contactInitials = computed(() => {
  const name = contactDisplayName.value
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

const canSend = computed(() => !!activeContact.value?.public_key)

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const scrollToBottom = async () => {
  await nextTick()
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }
}

watch(
  activeContact,
  async (contact) => {
    sendError.value = ''
    if (!contact) {
      clearMessages()
      return
    }
    isLoadingHistory.value = true
    try {
      await loadHistory(contact.id)
      await scrollToBottom()
    } catch (err) {
      const msg = (err as { data?: { message?: string }; message?: string })?.data?.message
        || (err as { message?: string })?.message
        || 'Failed to load message history.'
      sendError.value = msg
    } finally {
      isLoadingHistory.value = false
    }
  },
  { immediate: true },
)

watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  },
)

const onSend = async () => {
  if (!activeContact.value || !canSend.value) return
  const text = newMessage.value.trim()
  if (!text) return

  isSending.value = true
  sendError.value = ''
  const draft = newMessage.value
  newMessage.value = ''

  try {
    await sendMessage(
      activeContact.value.id,
      text,
      activeContact.value.public_key as string,
    )
  } catch (err) {
    newMessage.value = draft
    const msg = (err as { data?: { message?: string }; message?: string })?.data?.message
      || (err as { message?: string })?.message
      || 'Failed to send message.'
    sendError.value = msg
  } finally {
    isSending.value = false
  }
}

onMounted(() => {
  connectWS()
})

onBeforeUnmount(() => {
  disconnectWS()
})
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
