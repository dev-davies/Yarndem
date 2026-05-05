const WS_BASE_URL = 'wss://whisperbox.koyeb.app/ws'

export interface DecryptedMessage {
  id: string
  conversationId?: string
  senderId: string
  recipientId: string
  text: string
  createdAt: string
  sentBySelf: boolean
  status?: 'sent' | 'delivered' | 'read' | 'failed'
}

interface EncryptedMessageEnvelope {
  id: string
  conversation_id?: string
  sender_id: string
  recipient_id: string
  ciphertext: string
  iv: string
  encrypted_key: string
  encrypted_key_for_self?: string
  created_at: string
}

interface WSFrame<T = unknown> {
  type: string
  payload?: T
  data?: T
}

export const useMessages = () => {
  const accessToken = useCookie<string | null>('access_token')
  const { encryptMessage, decryptMessage, getActivePublicKey, setActivePublicKey } = useCrypto()
  const { currentUser } = useAuth()
  const { saveLocalMessage, getLocalMessages, getRecentContacts } = useStorage()
  const { conversations, setActiveContact } = useChat()

  const conversationKey = (otherUserId: string): string => {
    const me = currentUser.value?.id || 'me'
    return [me, otherUserId].sort().join(':')
  }

  const messages = useState<DecryptedMessage[]>('messages:list', () => [])
  const ws = useState<WebSocket | null>('messages:ws', () => null)
  const isConnected = useState<boolean>('messages:wsConnected', () => false)
  const activeConversationUserId = useState<string | null>('messages:activeUser', () => null)
  const isContactTyping = useState<boolean>('messages:isContactTyping', () => false)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let manuallyClosed = false
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let lastTypingSentAt = 0

  const isMine = (senderId: string): boolean => {
    return !!currentUser.value && currentUser.value.id === senderId
  }

  const toEncryptedPayload = (envelope: EncryptedMessageEnvelope) => ({
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    encryptedKey: envelope.encrypted_key,
    encryptedKeyForSelf: envelope.encrypted_key_for_self || envelope.encrypted_key,
  })

  const decryptEnvelope = async (
    envelope: EncryptedMessageEnvelope,
  ): Promise<DecryptedMessage> => {
    const sentBySelf = isMine(envelope.sender_id)
    let text: string
    try {
      text = await decryptMessage(toEncryptedPayload(envelope), sentBySelf)
    } catch {
      text = '[Unable to decrypt message]'
    }

    return {
      id: envelope.id,
      conversationId: envelope.conversation_id,
      senderId: envelope.sender_id,
      recipientId: envelope.recipient_id,
      text,
      createdAt: envelope.created_at,
      sentBySelf,
      status: 'delivered',
    }
  }

  const connectWS = (): WebSocket | null => {
    if (typeof window === 'undefined') return null
    if (!accessToken.value) {
      console.warn('Cannot open WebSocket: no access token.')
      return null
    }
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return ws.value
    }

    manuallyClosed = false
    const socket = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(accessToken.value)}`)
    ws.value = socket

    socket.onopen = () => {
      isConnected.value = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    socket.onmessage = async (event: MessageEvent) => {
      let frame: WSFrame<EncryptedMessageEnvelope>
      try {
        frame = JSON.parse(event.data)
      } catch (err) {
        console.error('Invalid WS frame', err)
        return
      }

      if (frame.type === 'typing') {
        const payload = (frame.payload || frame.data) as { sender_id?: string } | undefined
        const senderId = payload?.sender_id
        const activeId = activeConversationUserId.value
        if (!senderId || !activeId || senderId !== activeId) return

        isContactTyping.value = true
        if (typingTimeout) clearTimeout(typingTimeout)
        typingTimeout = setTimeout(() => {
          isContactTyping.value = false
          typingTimeout = null
        }, 3000)
        return
      }

      if (frame.type === 'read') {
        const payload = (frame.payload || frame.data) as
          | { message_id?: string; reader_id?: string }
          | undefined
        const messageId = payload?.message_id
        if (!messageId) return

        const idx = messages.value.findIndex((m) => m.id === messageId)
        if (idx === -1) return
        const next = [...messages.value]
        next[idx] = { ...next[idx], status: 'read' }
        messages.value = next
        return
      }

      if (frame.type === 'message.receive') {
        const envelope = (frame.payload || frame.data) as EncryptedMessageEnvelope | undefined
        if (!envelope) return

        const myId = currentUser.value?.id
        const otherUserId = envelope.sender_id === myId ? envelope.recipient_id : envelope.sender_id
        const decrypted = await decryptEnvelope(envelope)

        try {
          await saveLocalMessage(conversationKey(otherUserId), decrypted as never)
        } catch (err) {
          console.error('Failed to archive incoming message', err)
        }

        const existingConvo = conversations.value.find((c) => c.contact.id === otherUserId)
        if (!existingConvo) {
          try {
            const userProfile = await useApi<{ id: string; username: string; display_name: string; public_key?: string }>(
              `/users/${otherUserId}`,
              { method: 'GET' },
            )
            setActiveContact(userProfile)
          } catch (err) {
            console.warn(`Failed to fetch user profile for ${otherUserId}`, err)
            setActiveContact({
              id: otherUserId,
              username: otherUserId,
              display_name: otherUserId,
            })
          }
        }

        const activeId = activeConversationUserId.value
        const involvesActive =
          !!activeId &&
          (envelope.sender_id === activeId || envelope.recipient_id === activeId)
        if (!involvesActive) return

        if (messages.value.some((m) => m.id === decrypted.id)) return
        messages.value = [...messages.value, decrypted]
      }
    }

    socket.onclose = () => {
      isConnected.value = false
      ws.value = null
      if (!manuallyClosed && accessToken.value) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => connectWS(), 2000)
      }
    }

    socket.onerror = (err) => {
      console.error('WebSocket error', err)
    }

    return socket
  }

  const disconnectWS = () => {
    manuallyClosed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
  }

  const loadHistory = async (userId: string): Promise<DecryptedMessage[]> => {
    if (!accessToken.value) {
      throw new Error('Not authenticated')
    }

    activeConversationUserId.value = userId
    const convoKey = conversationKey(userId)

    const cached = await getLocalMessages(convoKey)
    if (cached.length > 0) {
      messages.value = cached as DecryptedMessage[]
    } else {
      messages.value = []
    }

    const cachedIds = new Set(cached.map((m) => m.id))

    try {
      const response = await useApi<EncryptedMessageEnvelope[] | { messages: EncryptedMessageEnvelope[] }>(
        `/conversations/${userId}/messages`,
        { method: 'GET' },
      )

      const list = Array.isArray(response) ? response : response?.messages ?? []
      const fresh = list.filter((env) => !cachedIds.has(env.id))
      if (fresh.length === 0) {
        return messages.value
      }

      const decrypted = await Promise.all(fresh.map((env) => decryptEnvelope(env)))

      await Promise.all(
        decrypted.map((m) => saveLocalMessage(convoKey, m as never)),
      )

      const merged = [...messages.value, ...decrypted]
        .filter((m, idx, arr) => arr.findIndex((x) => x.id === m.id) === idx)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      messages.value = merged
      return merged
    } catch (err) {
      console.error('Failed to fetch fresh history', err)
      return messages.value
    }
  }

  const clearMessages = () => {
    messages.value = []
    activeConversationUserId.value = null
    isContactTyping.value = false
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }
  }

  const sendTypingEvent = (toUserId: string): void => {
    const socket = ws.value
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const now = Date.now()
    if (now - lastTypingSentAt < 2000) return
    lastTypingSentAt = now

    try {
      socket.send(
        JSON.stringify({
          type: 'typing',
          payload: { recipient_id: toUserId },
        }),
      )
    } catch (err) {
      console.warn('Failed to send typing event', err)
    }
  }

  const sendReadReceipt = (messageId: string, senderId: string): void => {
    const socket = ws.value
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    if (!messageId || !senderId) return

    try {
      socket.send(
        JSON.stringify({
          type: 'read',
          payload: { message_id: messageId, sender_id: senderId },
        }),
      )
    } catch (err) {
      console.warn('Failed to send read receipt', err)
    }
  }

  const loadSidebar = async (): Promise<void> => {
    const contactIds = await getRecentContacts()
    if (contactIds.length === 0) return

    for (const id of contactIds) {
      try {
        const response = await useApi<{ id: string; username: string; display_name: string; public_key?: string }>(
          `/users/${id}`,
          { method: 'GET' },
        )
        setActiveContact(response)
      } catch (err) {
        console.warn(`Failed to fetch user ${id}, using ID as fallback`, err)
        setActiveContact({
          id,
          username: id,
          display_name: id,
        })
      }
    }
  }

  const sendMessage = async (
    toUserId: string,
    plaintext: string,
    recipientPublicKey: string,
  ): Promise<DecryptedMessage> => {
    const trimmed = plaintext.trim()
    if (!trimmed) {
      throw new Error('Cannot send an empty message.')
    }
    if (!accessToken.value) {
      throw new Error('Not authenticated')
    }

    if (!getActivePublicKey() && currentUser.value?.public_key) {
      try {
        await setActivePublicKey(currentUser.value.public_key)
      } catch (err) {
        console.warn('Failed to import own public key from profile', err)
      }
    }

    const payload = await encryptMessage(trimmed, recipientPublicKey)

    const wireBody = {
      to: toUserId,
      payload: {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        encryptedKey: payload.encryptedKey,
        encryptedKeyForSelf: payload.encryptedKeyForSelf,
      },
    }

    const convoKey = conversationKey(toUserId)
    const optimistic: DecryptedMessage = {
      id: `local-${Date.now()}`,
      senderId: currentUser.value?.id || 'me',
      recipientId: toUserId,
      text: trimmed,
      createdAt: new Date().toISOString(),
      sentBySelf: true,
      status: 'sent',
    }
    messages.value = [...messages.value, optimistic]

    const socket = ws.value
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'message.send', payload: wireBody }))
        await saveLocalMessage(convoKey, optimistic as never)
        return optimistic
      } catch (err) {
        console.warn('WS send failed, falling back to REST.', err)
      }
    }

    try {
      const saved = await useApi<EncryptedMessageEnvelope>('/messages', {
        method: 'POST',
        body: wireBody,
      })

      const idx = messages.value.findIndex((m) => m.id === optimistic.id)
      let finalMessage: DecryptedMessage = optimistic
      if (idx !== -1) {
        finalMessage = {
          ...optimistic,
          id: saved.id,
          createdAt: saved.created_at,
          conversationId: saved.conversation_id,
          status: 'delivered',
        }
        const next = [...messages.value]
        next[idx] = finalMessage
        messages.value = next
      }
      await saveLocalMessage(convoKey, finalMessage as never)
      return finalMessage
    } catch (err) {
      const idx = messages.value.findIndex((m) => m.id === optimistic.id)
      if (idx !== -1) {
        const next = [...messages.value]
        next[idx] = { ...optimistic, status: 'failed' }
        messages.value = next
      }
      throw err
    }
  }

  return {
    messages,
    ws,
    isConnected,
    activeConversationUserId,
    isContactTyping,
    connectWS,
    disconnectWS,
    loadHistory,
    clearMessages,
    sendMessage,
    sendTypingEvent,
    sendReadReceipt,
    loadSidebar,
  }
}
