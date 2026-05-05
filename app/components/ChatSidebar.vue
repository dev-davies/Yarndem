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
          v-model="searchQuery"
          type="text"
          placeholder="Search users by username..."
          class="block w-full pl-11 pr-10 py-3 bg-yarn-surface border border-yarn-border rounded-2xl text-sm placeholder-yarn-black/30 focus:outline-none focus:ring-2 focus:ring-yarn-terracotta/20 focus:border-yarn-terracotta transition-all duration-300"
        />
        <button
          v-if="searchQuery"
          class="absolute inset-y-0 right-0 pr-4 flex items-center text-yarn-black/30 hover:text-yarn-terracotta transition-colors"
          aria-label="Clear search"
          @click="resetSearch"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="hasQuery" class="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6">
      <div class="px-3 mb-2 flex items-center justify-between">
        <span class="text-[10px] uppercase tracking-widest font-semibold text-yarn-black/40">
          Search Results
        </span>
        <span v-if="isSearching" class="text-[10px] text-yarn-black/40">Searching…</span>
      </div>

      <div v-if="!isSearching && searchResults.length === 0" class="px-4 py-6 text-center text-xs text-yarn-black/40">
        No users found for "{{ searchQuery }}".
      </div>

      <div class="space-y-1">
        <div
          v-for="user in searchResults"
          :key="user.id"
          class="relative flex items-center p-4 rounded-2xl cursor-pointer transition-all duration-300 group"
          :class="[
            isActive(user)
              ? 'bg-yarn-surface border-l-4 border-yarn-terracotta shadow-sm shadow-yarn-black/5'
              : 'hover:bg-yarn-surface/50 border-l-4 border-transparent'
          ]"
          @click="onSelectUser(user)"
        >
          <div class="relative h-12 w-12 rounded-full bg-yarn-stone border border-yarn-border flex items-center justify-center text-yarn-black font-semibold text-sm flex-shrink-0">
            {{ getInitials(user.display_name || user.username) }}
          </div>
          <div class="ml-4 flex-1 min-w-0">
            <h3 class="text-sm font-bold text-yarn-black truncate">{{ user.display_name || user.username }}</h3>
            <p class="text-xs text-yarn-black/40 truncate mt-1">@{{ user.username }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Conversation List -->
    <div v-else class="flex-1 overflow-y-auto custom-scrollbar px-3">
      <div v-if="isLoadingConversations" class="px-4 py-6 text-center text-xs text-yarn-black/40">
        Loading conversations…
      </div>

      <div v-else-if="conversations.length === 0" class="px-4 py-10 text-center">
        <p class="text-sm text-yarn-black/50 font-medium">No conversations yet</p>
        <p class="text-xs text-yarn-black/40 mt-1">Search above to find people to chat with.</p>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          class="relative flex items-center p-4 rounded-2xl cursor-pointer transition-all duration-300 group"
          :class="[
            isActive(conversation.contact)
              ? 'bg-yarn-surface border-l-4 border-yarn-terracotta shadow-sm shadow-yarn-black/5'
              : 'hover:bg-yarn-surface/50 border-l-4 border-transparent'
          ]"
          @click="onSelectUser(conversation.contact)"
        >
          <!-- Avatar -->
          <div class="relative h-12 w-12 rounded-full bg-yarn-stone border border-yarn-border flex items-center justify-center text-yarn-black font-semibold text-sm flex-shrink-0">
            {{ getInitials(conversation.contact.display_name || conversation.contact.username) }}
          </div>

          <!-- Content -->
          <div class="ml-4 flex-1 min-w-0">
            <div class="flex justify-between items-baseline">
              <h3 class="text-sm font-bold text-yarn-black truncate">
                {{ conversation.contact.display_name || conversation.contact.username }}
              </h3>
              <span class="text-[10px] font-medium text-yarn-black/40 uppercase tracking-tighter">
                {{ formatTime(conversation.last_message?.created_at || conversation.updated_at) }}
              </span>
            </div>
            <p
              class="text-xs truncate mt-1"
              :class="isActive(conversation.contact) ? 'text-yarn-black/60' : 'text-yarn-black/40'"
            >
              @{{ conversation.contact.username }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer / Vault Controls -->
    <div class="border-t border-yarn-border bg-yarn-surface/60 px-4 py-4 flex items-center justify-between">
      <div class="min-w-0">
        <p class="text-xs font-bold text-yarn-black truncate">
          {{ currentUser?.display_name || currentUser?.username || 'Signed out' }}
        </p>
        <p class="text-[10px] uppercase tracking-widest text-yarn-black/40 truncate">
          @{{ currentUser?.username || '—' }}
        </p>
      </div>
      <button
        type="button"
        :disabled="isLoggingOut"
        class="ml-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-yarn-border bg-yarn-bg hover:border-yarn-terracotta hover:text-yarn-terracotta text-yarn-black/70 transition-colors duration-200 disabled:opacity-50"
        title="Sign out and wipe local vault"
        @click="onLogout"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span class="text-[11px] font-bold uppercase tracking-widest">
          {{ isLoggingOut ? 'Wiping…' : 'Lock Vault' }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const {
  conversations,
  searchResults,
  activeContact,
  isSearching,
  isLoadingConversations,
  searchUsers,
  clearSearch,
  loadConversations,
  setActiveContact,
} = useChat()

const { currentUser, logout } = useAuth()
const isLoggingOut = ref(false)

const onLogout = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await logout()
  } finally {
    isLoggingOut.value = false
  }
}

const searchQuery = ref('')
const hasQuery = computed(() => searchQuery.value.trim().length > 0)

watch(searchQuery, (value) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    clearSearch()
    return
  }
  searchUsers(trimmed)
})

const resetSearch = () => {
  searchQuery.value = ''
  clearSearch()
}

const onSelectUser = (user: Contact) => {
  setActiveContact(user)
  if (hasQuery.value) {
    resetSearch()
  }
}

const isActive = (user: Contact): boolean => {
  return !!activeContact.value && activeContact.value.id === user.id
}

const getInitials = (name: string): string => {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const formatTime = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

onMounted(() => {
  loadConversations()
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
</style>
