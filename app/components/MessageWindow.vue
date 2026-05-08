
<template>
  <div v-if="!activeContact" class="flex items-center justify-center h-full bg-yarn-bg">
    <div v-if="currentUser" class="text-center px-8 max-w-md">
      <div class="mx-auto h-20 w-20 bg-yarn-black flex items-center justify-center rounded-2xl mb-8 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-yarn-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h2 class="text-2xl font-display font-semibold text-yarn-black tracking-tight mb-3">
        Welcome back, {{ currentUser.display_name || currentUser.username }}!
      </h2>
      <p class="text-sm text-yarn-black/60 leading-relaxed">
        Select a contact from the sidebar or search for someone new to start a secure, end-to-end encrypted conversation.
      </p>
    </div>
    <div v-else class="text-center px-8 max-w-md">
      <div class="mx-auto h-20 w-20 bg-yarn-surface border border-yarn-border flex items-center justify-center rounded-2xl mb-8">
        <svg class="animate-spin h-8 w-8 text-yarn-black/40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      </div>
      <p class="text-sm text-yarn-black/50">Loading your account...</p>
    </div>
  </div>

  <div v-else class="flex flex-col h-full bg-yarn-bg overflow-hidden">
    <!-- Header -->
    <header class="px-3 py-3 sm:px-4 md:p-6 border-b border-yarn-border bg-yarn-surface flex justify-between items-center gap-3 z-10">
      <div class="flex items-center gap-3 min-w-0">
        <button
          type="button"
          class="md:hidden h-10 w-10 rounded-full border border-yarn-border bg-yarn-bg flex items-center justify-center text-yarn-black/70 active:scale-95 flex-shrink-0"
          aria-label="Back to conversations"
          @click="emit('back')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="relative h-10 w-10 md:h-12 md:w-12 rounded-full bg-yarn-stone border border-yarn-border flex items-center justify-center text-yarn-black font-semibold text-xs md:text-sm flex-shrink-0">
          {{ contactInitials }}
          <span
            class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-yarn-surface"
            :class="activeContactIsOnline ? 'bg-emerald-500' : 'bg-yarn-black/25'"
            :title="activeContactStatusLabel"
          />
        </div>
        <div class="min-w-0">
          <h2 class="text-sm md:text-base font-bold text-yarn-black truncate">{{ contactDisplayName }}</h2>
          <p class="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <span class="text-yarn-black/40 truncate">@{{ activeContact.username }}</span>
            <span :class="activeContactIsOnline ? 'text-emerald-600' : 'text-yarn-black/35'">
              {{ activeContactStatusLabel }}
            </span>
          </p>
        </div>
      </div>

      <div class="hidden sm:flex items-center px-3 md:px-4 py-1.5 bg-yarn-terracotta/10 rounded-full border border-yarn-terracotta/20 flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-yarn-terracotta mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span class="text-[10px] font-bold text-yarn-terracotta uppercase tracking-widest">End-to-End Encrypted</span>
      </div>
    </header>

    <!-- Message Area -->
    <div
      ref="scrollEl"
      class="flex-1 overflow-y-auto px-3 py-4 sm:p-4 md:p-6 space-y-3 md:space-y-6 custom-scrollbar bg-[radial-gradient(#C05A3E05_1px,transparent_1px)] [background-size:20px_20px]"
      @scroll.passive="onScroll"
    >
      <div v-if="isLoadingHistory" class="flex justify-center py-8">
        <span class="text-xs text-yarn-black/40 uppercase tracking-widest">Decrypting messages...</span>
      </div>

      <div v-else-if="isLoadingOlderMessages" class="flex justify-center py-2">
        <span class="text-[10px] text-yarn-black/35 uppercase tracking-widest">Loading older messages...</span>
      </div>

      <div v-else-if="messages.length === 0" class="flex justify-center py-12">
        <p class="text-xs text-yarn-black/40 max-w-xs text-center">
          No messages yet. Say something - it'll be end-to-end encrypted before it leaves your device.
        </p>
      </div>

      <div
        v-for="message in messages"
        :key="message.id"
        :data-message-id="message.id"
        :data-sender-id="message.senderId"
        :data-sent-by-self="message.sentBySelf ? 'true' : 'false'"
        class="flex message-row"
        :class="message.sentBySelf ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[86%] sm:max-w-[80%] md:max-w-[75%] shadow-sm px-4 py-3 md:px-5 md:py-4"
          :class="[
            message.sentBySelf
              ? 'bg-yarn-black text-white rounded-2xl rounded-br-none'
              : 'bg-yarn-surface text-yarn-black border border-yarn-border rounded-2xl rounded-bl-none',
            message.status === 'failed' ? 'opacity-60 ring-1 ring-red-400/40' : ''
          ]"
        >
          <div v-if="message.kind === 'file' && message.attachment" class="space-y-2">
            <img
              v-if="isImageAttachment(message.attachment)"
              :src="attachmentUrl(message.attachment)"
              :alt="message.attachment.name"
              class="max-h-72 w-full rounded-xl object-cover"
            />
            <a
              :href="attachmentUrl(message.attachment)"
              :download="message.attachment.name"
              class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors"
              :class="message.sentBySelf ? 'bg-white/10 hover:bg-white/15' : 'bg-yarn-bg hover:bg-yarn-stone'"
            >
              <span class="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" :class="message.sentBySelf ? 'bg-white/10' : 'bg-yarn-stone'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-semibold">{{ message.attachment.name }}</span>
                <span class="block text-[10px] uppercase opacity-60">{{ formatFileSize(message.attachment.size) }}</span>
              </span>
            </a>
          </div>
          <p v-else class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ message.text }}</p>

          <div
            class="mt-2 text-[9px] uppercase tracking-tighter opacity-50 flex items-center gap-1.5"
            :class="message.sentBySelf ? 'justify-end' : 'justify-start'"
          >
            <span>{{ formatTime(message.createdAt) }}</span>
            <span v-if="message.sentBySelf && message.status === 'failed'" class="text-red-300">Failed</span>
            <span
              v-else-if="message.sentBySelf"
              class="inline-flex items-center"
              :class="message.status === 'read' ? 'text-sky-400 opacity-100' : 'opacity-70'"
              :title="message.status === 'read' ? 'Read' : message.status === 'delivered' ? 'Delivered' : 'Sent'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 6.5L4.5 10L11 2" />
              </svg>
              <svg
                v-if="message.status === 'delivered' || message.status === 'read'"
                xmlns="http://www.w3.org/2000/svg"
                class="h-3 w-3 -ml-1.5"
                viewBox="0 0 16 12"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 6.5L4.5 10L11 2" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div v-if="isContactTyping" class="flex justify-start">
        <div class="bg-yarn-surface border border-yarn-border rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
          <span class="typing-dot" />
          <span class="typing-dot typing-dot-2" />
          <span class="typing-dot typing-dot-3" />
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <footer class="px-3 py-3 sm:px-4 md:p-6 border-t border-yarn-border bg-yarn-surface">
      <div v-if="sendError" class="max-w-5xl mx-auto mb-3 text-xs text-red-600 bg-red-50/80 border border-red-300/60 rounded-xl px-4 py-2">
        {{ sendError }}
      </div>

      <form class="flex items-center gap-2 md:gap-4 max-w-5xl mx-auto" @submit.prevent="onSend">
        <!-- Attachment Button -->
        <input
          ref="fileInput"
          type="file"
          class="sr-only"
          :disabled="!canSend || isSending"
          @change="onFileSelected"
        />
        <button
          type="button"
          class="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full text-yarn-black/40 hover:text-yarn-black hover:bg-yarn-bg transition-colors duration-300 flex-shrink-0 disabled:opacity-40"
          title="Attach file"
          :disabled="!canSend || isSending"
          @click="fileInput?.click()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <div class="flex-1 relative">
          <input
            v-model="newMessage"
            type="text"
            :placeholder="inputPlaceholder"
            :disabled="!canSend || isSending || isLoadingPublicKey"
            class="w-full bg-yarn-bg border border-yarn-border rounded-full px-4 md:px-6 py-3 md:py-4 text-sm focus:outline-none focus:ring-2 focus:ring-yarn-black/5 focus:border-yarn-black transition-all disabled:opacity-60"
            @input="onTyping"
          />
        </div>

        <button
          type="submit"
          :disabled="!canSend || isSending || !newMessage.trim()"
          class="p-3 md:p-4 rounded-full text-yarn-black hover:text-yarn-terracotta transition-colors duration-300 transform active:scale-90 disabled:opacity-40 disabled:hover:text-yarn-black flex-shrink-0"
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
import type { MessageAttachment } from '~/composables/useMessages'

const emit = defineEmits<{
  back: []
}>()

const { activeContact, activePublicKey, isLoadingPublicKey } = useChat()
const { currentUser } = useAuth()
const {
  messages,
  isContactTyping,
  isConnected,
  contactPresence,
  loadHistory,
  loadOlderMessages,
  clearMessages,
  sendMessage,
  sendFileMessage,
  sendTypingEvent,
  sendReadReceipt,
  isLoadingOlderMessages,
  hasMoreHistory,
} = useMessages()

const ackedReadIds = ref<Set<string>>(new Set())
let readObserver: IntersectionObserver | null = null

const newMessage = ref('')
const isSending = ref(false)
const isLoadingHistory = ref(false)
const sendError = ref('')
const scrollEl = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isPreservingOlderScroll = ref(false)

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

const activeContactPresence = computed(() => {
  const contactId = activeContact.value?.id
  return contactId ? contactPresence.value[contactId] : undefined
})

const activeContactIsOnline = computed(() => {
  return !!isConnected.value && !!activeContactPresence.value?.online
})

const activeContactStatusLabel = computed(() => {
  if (!isConnected.value) return 'Offline'
  if (activeContactIsOnline.value) return 'Online'
  return 'Offline'
})

const canSend = computed(() => {
  const result = !!activePublicKey.value && !isLoadingPublicKey.value
  console.log('[MessageWindow] canSend computed:', { activePublicKey: !!activePublicKey.value, isLoadingPublicKey: isLoadingPublicKey.value, result })
  return result
})

const inputPlaceholder = computed(() => {
  if (isLoadingPublicKey.value) return 'Fetching recipient key...'
  if (!activePublicKey.value) return 'Recipient public key missing - cannot send'
  return 'Type a secure message...'
})

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const attachmentUrl = (attachment: MessageAttachment): string => {
  return `data:${attachment.mimeType};base64,${attachment.dataBase64}`
}

const isImageAttachment = (attachment: MessageAttachment): boolean => {
  return attachment.mimeType.startsWith('image/')
}

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
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
    ackedReadIds.value = new Set()
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
    if (isPreservingOlderScroll.value) return
    scrollToBottom()
  },
)

const maybeLoadOlderMessages = async () => {
  const el = scrollEl.value
  const contact = activeContact.value
  if (!el || !contact || isLoadingHistory.value || isLoadingOlderMessages.value || !hasMoreHistory.value) {
    return
  }
  if (el.scrollTop > 96) return

  const previousScrollHeight = el.scrollHeight
  const previousScrollTop = el.scrollTop
  isPreservingOlderScroll.value = true
  sendError.value = ''

  try {
    await loadOlderMessages(contact.id)
    await nextTick()
    if (scrollEl.value && activeContact.value?.id === contact.id) {
      scrollEl.value.scrollTop =
        scrollEl.value.scrollHeight - previousScrollHeight + previousScrollTop
    }
  } catch (err) {
    const msg = (err as { data?: { message?: string }; message?: string })?.data?.message
      || (err as { message?: string })?.message
      || 'Failed to load older messages.'
    sendError.value = msg
  } finally {
    await nextTick()
    isPreservingOlderScroll.value = false
  }
}

const onScroll = () => {
  void maybeLoadOlderMessages()
}

const onTyping = () => {
  if (activeContact.value) {
    sendTypingEvent(activeContact.value.id)
  }
}

const ackVisibleReads = () => {
  if (!readObserver || !scrollEl.value) return
  const rows = scrollEl.value.querySelectorAll<HTMLElement>(
    '.message-row[data-sent-by-self="false"]',
  )
  rows.forEach((row) => {
    const id = row.dataset.messageId
    if (id && !ackedReadIds.value.has(id)) {
      readObserver!.observe(row)
    }
  })
}

watch(
  () => messages.value.map((m) => m.id).join('|'),
  async () => {
    await nextTick()
    ackVisibleReads()
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
      activePublicKey.value as string,
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

const onFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !activeContact.value || !canSend.value) {
    input.value = ''
    return
  }

  isSending.value = true
  sendError.value = ''

  try {
    await sendFileMessage(
      activeContact.value.id,
      file,
      activePublicKey.value as string,
    )
  } catch (err) {
    const msg = (err as { data?: { message?: string }; message?: string })?.data?.message
      || (err as { message?: string })?.message
      || 'Failed to send file.'
    sendError.value = msg
  } finally {
    input.value = ''
    isSending.value = false
  }
}

onMounted(() => {
  if (typeof IntersectionObserver !== 'undefined' && scrollEl.value) {
    readObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          const id = el.dataset.messageId
          const senderId = el.dataset.senderId
          if (!id || !senderId || ackedReadIds.value.has(id)) continue
          ackedReadIds.value.add(id)
          sendReadReceipt(id, senderId)
          readObserver!.unobserve(el)
        }
      },
      { root: scrollEl.value, threshold: 0.6 },
    )
    ackVisibleReads()
  }
})

onBeforeUnmount(() => {
  if (readObserver) {
    readObserver.disconnect()
    readObserver = null
  }
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

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: rgba(0, 0, 0, 0.3);
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing-dot-2 {
  animation-delay: 0.15s;
}
.typing-dot-3 {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
