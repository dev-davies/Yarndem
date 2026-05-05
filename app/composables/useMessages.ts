const API_BASE_URL = 'https://whisperbox.koyeb.app'
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
  const { encryptMessage, decryptMessage } = useCrypto()
  const { currentUser } = useAuth()

  const messages = useState<DecryptedMessage[]>('messages:list', () => [])
  const ws = useState<WebSocket | null>('messages:ws', () => null)
  const isConnected = useState<boolean>('messages:wsConnected', () => false)
  const activeConversationUserId = useState<string | null>('messages:activeUser', () => null)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let manuallyClosed = false

  const authHeaders = (): Record<string, string> => {
    const token = accessToken.value
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

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
    } catch (err) {
      console.error('Failed to decrypt message', envelope.id, err)
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

      if (frame.type === 'message.receive') {
        const envelope = (frame.payload || frame.data) as EncryptedMessageEnvelope | undefined
        if (!envelope) return

        const activeId = activeConversationUserId.value
        const involvesActive =
          !!activeId &&
          (envelope.sender_id === activeId || envelope.recipient_id === activeId)
        if (!involvesActive) return

        const decrypted = await decryptEnvelope(envelope)
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

    const response = await $fetch<EncryptedMessageEnvelope[] | { messages: EncryptedMessageEnvelope[] }>(
      `/conversations/${userId}/messages`,
      {
        baseURL: API_BASE_URL,
        method: 'GET',
        headers: authHeaders(),
      },
    )

    const list = Array.isArray(response) ? response : response?.messages ?? []

    const decrypted = await Promise.all(list.map((env) => decryptEnvelope(env)))
    decrypted.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

    messages.value = decrypted
    return decrypted
  }

  const clearMessages = () => {
    messages.value = []
    activeConversationUserId.value = null
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

    const payload = await encryptMessage(trimmed, recipientPublicKey)

    const wireBody = {
      recipient_id: toUserId,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      encrypted_key: payload.encryptedKey,
      encrypted_key_for_self: payload.encryptedKeyForSelf,
    }

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
        return optimistic
      } catch (err) {
        console.warn('WS send failed, falling back to REST.', err)
      }
    }

    try {
      const saved = await $fetch<EncryptedMessageEnvelope>('/messages', {
        baseURL: API_BASE_URL,
        method: 'POST',
        headers: authHeaders(),
        body: wireBody,
      })

      const idx = messages.value.findIndex((m) => m.id === optimistic.id)
      if (idx !== -1) {
        const replacement: DecryptedMessage = {
          ...optimistic,
          id: saved.id,
          createdAt: saved.created_at,
          conversationId: saved.conversation_id,
          status: 'delivered',
        }
        const next = [...messages.value]
        next[idx] = replacement
        messages.value = next
        return replacement
      }
      return optimistic
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
    connectWS,
    disconnectWS,
    loadHistory,
    clearMessages,
    sendMessage,
  }
}
