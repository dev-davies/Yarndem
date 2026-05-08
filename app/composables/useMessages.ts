const WS_BASE_URL = 'wss://whisperbox.koyeb.app/ws'

export interface DecryptedMessage {
  id: string
  conversationId?: string
  senderId: string
  recipientId: string
  text: string
  kind?: 'text' | 'file'
  attachment?: MessageAttachment
  createdAt: string
  sentBySelf: boolean
  status?: 'sent' | 'delivered' | 'read' | 'failed'
}

export interface MessageAttachment {
  name: string
  mimeType: string
  size: number
  dataBase64: string
}

interface ServerEncryptedPayload {
  ciphertext: string
  iv: string
  encryptedKey: string
  encryptedKeyForSelf: string
}

interface EncryptedMessageEnvelope {
  id: string
  from_user_id: string
  to_user_id: string
  payload: ServerEncryptedPayload
  delivered?: boolean
  created_at: string
}

interface MessageHistoryResponse {
  messages?: EncryptedMessageEnvelope[]
  data?: EncryptedMessageEnvelope[]
  has_more?: boolean
  hasMore?: boolean
  next_cursor?: string | null
  nextCursor?: string | null
  cursor?: string | null
}

interface WSFrame<T = unknown> {
  type: string
  payload?: T
  data?: T
}

type MessageFramePayload =
  | EncryptedMessageEnvelope
  | {
      message?: EncryptedMessageEnvelope
      envelope?: EncryptedMessageEnvelope
    }
  | undefined

interface ContactPresence {
  online: boolean
  lastSeen?: string
}

interface EncodedFileMessage {
  __yarn_message_type: 'file'
  version: 1
  file: MessageAttachment
}

type SendableMessageContent = {
  plaintext: string
  preview: string
  kind?: DecryptedMessage['kind']
  attachment?: MessageAttachment
}

type PresencePayload =
  | {
      user_id?: string
      userId?: string
      id?: string
      sender_id?: string
      user?: PresencePayload
      contact?: PresencePayload
      online?: boolean
      is_online?: boolean
      isOnline?: boolean
      status?: string
      last_seen?: string
      lastSeen?: string
      users?: PresencePayload[]
      online_users?: PresencePayload[]
      offline_users?: PresencePayload[]
      online_user_ids?: string[]
      offline_user_ids?: string[]
    }
  | string
  | PresencePayload[]
  | undefined

export const useMessages = () => {
  const accessToken = useCookie<string | null>('access_token')
  const {
    encryptMessage,
    decryptMessage,
    getActivePublicKey,
    setActivePublicKey,
    arrayBufferToBase64,
  } = useCrypto()
  const { currentUser } = useAuth()
  const { saveLocalMessage, getLocalMessages, getRecentContacts } = useStorage()
  const { conversations, activeContact, upsertConversation } = useChat()

  const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
  const MESSAGE_PAGE_SIZE = 50

  const getMyId = (): string | null => currentUser.value?.id ?? null

  const conversationKey = (otherUserId: string, myId?: string | null): string => {
    const me = myId ?? getMyId()
    if (!me) return 'unknown:' + otherUserId
    return [me, otherUserId].sort().join(':')
  }

  const getActiveChatUserId = (): string | null => {
    return activeConversationUserId.value || activeContact.value?.id || null
  }

  const messages = useState<DecryptedMessage[]>('messages:list', () => [])
  const ws = useState<WebSocket | null>('messages:ws', () => null)
  const isConnected = useState<boolean>('messages:wsConnected', () => false)
  const activeConversationUserId = useState<string | null>('messages:activeUser', () => null)
  const isContactTyping = useState<boolean>('messages:isContactTyping', () => false)
  const isLoadingOlderMessages = useState<boolean>('messages:isLoadingOlder', () => false)
  const hasMoreHistory = useState<boolean>('messages:hasMoreHistory', () => true)
  const historyCursor = useState<string | null>('messages:historyCursor', () => null)
  const contactPresence = useState<Record<string, ContactPresence>>('messages:contactPresence', () => ({}))

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let manuallyClosed = false
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let lastTypingSentAt = 0

  const isMine = (senderId: string): boolean => {
    return !!currentUser.value && currentUser.value.id === senderId
  }

  const appendMessageForActiveChat = (message: DecryptedMessage): void => {
    const activeId = getActiveChatUserId()
    if (!activeId) return

    const activeIdText = String(activeId)
    const belongsToActiveChat =
      String(message.senderId) === activeIdText ||
      String(message.recipientId) === activeIdText

    if (!belongsToActiveChat) return
    if (messages.value.some((m) => m.id === message.id)) return
    messages.value = [...messages.value, message]
  }

  const setContactPresence = (userId: string, online: boolean, lastSeen?: string): void => {
    if (!userId || userId === getMyId()) return
    contactPresence.value = {
      ...contactPresence.value,
      [userId]: {
        online,
        lastSeen: lastSeen || contactPresence.value[userId]?.lastSeen,
      },
    }
  }

  const normalizePresence = (payload: PresencePayload, frameType: string): boolean => {
    if (!payload) return false

    if (typeof payload === 'string') {
      setContactPresence(payload, frameType.includes('online') && !frameType.includes('offline'))
      return true
    }

    if (Array.isArray(payload)) {
      payload.forEach((item) => normalizePresence(item, frameType))
      return true
    }

    let handled = false

    if (Array.isArray(payload.online_user_ids)) {
      payload.online_user_ids.forEach((id) => setContactPresence(id, true))
      handled = true
    }
    if (Array.isArray(payload.offline_user_ids)) {
      payload.offline_user_ids.forEach((id) => setContactPresence(id, false, new Date().toISOString()))
      handled = true
    }
    if (Array.isArray(payload.users)) {
      payload.users.forEach((user) => normalizePresence(user, frameType))
      handled = true
    }
    if (Array.isArray(payload.online_users)) {
      payload.online_users.forEach((user) => normalizePresence(user, 'online'))
      handled = true
    }
    if (Array.isArray(payload.offline_users)) {
      payload.offline_users.forEach((user) => normalizePresence(user, 'offline'))
      handled = true
    }
    if (payload.user) {
      handled = normalizePresence(payload.user, frameType) || handled
    }
    if (payload.contact) {
      handled = normalizePresence(payload.contact, frameType) || handled
    }

    const userId = payload.user_id || payload.userId || payload.id || payload.sender_id
    if (!userId) {
      return handled
    }

    const status = payload.status?.toLowerCase()
    const online = typeof payload.online === 'boolean'
      ? payload.online
      : typeof payload.is_online === 'boolean'
        ? payload.is_online
        : typeof payload.isOnline === 'boolean'
          ? payload.isOnline
          : frameType.includes('offline')
            ? false
            : frameType.includes('online')
              ? true
              : status === 'online'

    if (status === 'online' || status === 'offline' || typeof payload.online === 'boolean' || typeof payload.is_online === 'boolean' || typeof payload.isOnline === 'boolean' || frameType.includes('online') || frameType.includes('offline')) {
      setContactPresence(userId, online, payload.last_seen || payload.lastSeen)
      return true
    }

    return handled
  }

  const toEncryptedPayload = (envelope: EncryptedMessageEnvelope): EncryptedMessagePayload => ({
    ciphertext: envelope.payload?.ciphertext || '',
    iv: envelope.payload?.iv || '',
    encryptedKey: envelope.payload?.encryptedKey || '',
    encryptedKeyForSelf: envelope.payload?.encryptedKeyForSelf || '',
  })

  const normalizeHistoryResponse = (
    response: EncryptedMessageEnvelope[] | MessageHistoryResponse,
  ): {
    messages: EncryptedMessageEnvelope[]
    hasMore?: boolean
    nextCursor?: string | null
  } => {
    if (Array.isArray(response)) {
      return {
        messages: response,
        hasMore: response.length >= MESSAGE_PAGE_SIZE,
        nextCursor: null,
      }
    }

    const list = response.messages || response.data || []
    return {
      messages: list,
      hasMore: response.has_more ?? response.hasMore ?? (list.length >= MESSAGE_PAGE_SIZE),
      nextCursor: response.next_cursor ?? response.nextCursor ?? response.cursor ?? null,
    }
  }

  const mergeMessages = (
    current: DecryptedMessage[],
    incoming: DecryptedMessage[],
  ): DecryptedMessage[] => {
    return [...current, ...incoming]
      .filter((m, idx, arr) => arr.findIndex((x) => x.id === m.id) === idx)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  const oldestLoadedMessage = (): DecryptedMessage | undefined => {
    return messages.value
      .filter((message) => !message.id.startsWith('local-'))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
  }

  const loadHistoryPage = async (
    userId: string,
    options: { older?: boolean } = {},
  ): Promise<{
    messages: EncryptedMessageEnvelope[]
    hasMore?: boolean
    nextCursor?: string | null
  }> => {
    const query: Record<string, string | number> = {
      limit: MESSAGE_PAGE_SIZE,
    }

    if (options.older) {
      if (historyCursor.value) {
        query.cursor = historyCursor.value
      } else {
        const oldest = oldestLoadedMessage()
        if (oldest) {
          query.before = oldest.createdAt
          query.before_id = oldest.id
        }
      }
    }

    const response = await useApi<EncryptedMessageEnvelope[] | MessageHistoryResponse>(
      `/conversations/${userId}/messages`,
      {
        method: 'GET',
        query,
      },
    )

    return normalizeHistoryResponse(response)
  }

  const attachmentPreview = (attachment: MessageAttachment): string => {
    const label = attachment.mimeType.startsWith('image/') ? 'Image' : 'File'
    return `[${label}] ${attachment.name}`
  }

  const parsePlaintextMessage = (
    plaintext: string,
  ): Pick<DecryptedMessage, 'text' | 'kind' | 'attachment'> => {
    try {
      const parsed = JSON.parse(plaintext) as Partial<EncodedFileMessage>
      const file = parsed?.file
      if (
        parsed?.__yarn_message_type === 'file' &&
        file?.name &&
        file?.mimeType &&
        typeof file.size === 'number' &&
        file.dataBase64
      ) {
        return {
          text: attachmentPreview(file),
          kind: 'file',
          attachment: file,
        }
      }
    } catch {
      /* Plain text messages are not JSON encoded. */
    }

    return {
      text: plaintext,
      kind: 'text',
    }
  }

  const isMessageFrame = (type: string): boolean => {
    return [
      'message',
      'message.receive',
      'message.received',
      'message.created',
      'message.new',
      'new_message',
    ].includes(type)
  }

  const getEnvelopeFromFrame = (frame: WSFrame): EncryptedMessageEnvelope | undefined => {
    const raw = (frame.payload || frame.data) as MessageFramePayload
    if (!raw) return undefined
    if ('payload' in raw && raw.payload) return raw as EncryptedMessageEnvelope
    if ('message' in raw && raw.message?.payload) return raw.message
    if ('envelope' in raw && raw.envelope?.payload) return raw.envelope
    return undefined
  }

  const decryptEnvelope = async (
    envelope: EncryptedMessageEnvelope,
  ): Promise<DecryptedMessage> => {
    const sentBySelf = isMine(envelope.from_user_id)
    let text: string
    try {
      text = await decryptMessage(toEncryptedPayload(envelope), sentBySelf, envelope.id)
    } catch (err) {
      console.error(`[useMessages] Decryption failure for message ${envelope.id}:`, err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      text = `[Unable to decrypt message: ${errorMsg}]`
    }

    const content = parsePlaintextMessage(text)

    return {
      id: envelope.id,
      senderId: envelope.from_user_id,
      recipientId: envelope.to_user_id,
      ...content,
      createdAt: envelope.created_at,
      sentBySelf,
      status: envelope.delivered ? 'delivered' : 'sent',
    }
  }

  const connectWS = async (): Promise<WebSocket | null> => {
    if (typeof window === 'undefined') return null
    if (!accessToken.value) {
      console.warn('Cannot open WebSocket: no access token.')
      return null
    }
    if (ws.value && (ws.value.readyState === WebSocket.OPEN || ws.value.readyState === WebSocket.CONNECTING)) {
      return ws.value
    }

    const { getActivePrivateKey, retrieveSessionKey, setActivePublicKey, getActivePublicKey } = useCrypto()
    if (!getActivePrivateKey()) {
      try {
        await retrieveSessionKey()
      } catch (err) {
        console.warn('Failed to rehydrate session key before WS connect', err)
      }
    }
    if (!getActivePublicKey() && currentUser.value?.public_key) {
      try {
        await setActivePublicKey(currentUser.value.public_key)
      } catch (err) {
        console.warn('Failed to import own public key before WS connect', err)
      }
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
      let frame: WSFrame
      try {
        frame = JSON.parse(event.data)
      } catch (err) {
        console.error('Invalid WS frame', err)
        return
      }

      if (typeof frame?.type !== 'string') {
        const maybeEnvelope = frame as unknown as EncryptedMessageEnvelope
        if (maybeEnvelope?.payload && maybeEnvelope?.from_user_id && maybeEnvelope?.to_user_id) {
          frame = { type: 'message', payload: maybeEnvelope }
        } else {
          return
        }
      }

      if (frame.type === 'typing') {
        const payload = (frame.payload || frame.data) as { sender_id?: string } | undefined
        const senderId = payload?.sender_id
        if (senderId) {
          setContactPresence(senderId, true)
        }
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
        next[idx] = { ...next[idx], status: 'read' } as DecryptedMessage
        messages.value = next
        return
      }

      if (frame.type.startsWith('presence') || frame.type.startsWith('user.') || frame.type === 'online' || frame.type === 'offline') {
        if (normalizePresence((frame.payload || frame.data) as PresencePayload, frame.type)) {
          return
        }
      }

      if (isMessageFrame(frame.type)) {
        const envelope = getEnvelopeFromFrame(frame)
        if (!envelope || !envelope.payload) {
          console.warn('[useMessages] Received frame without payload', frame)
          return
        }

        const myId = currentUser.value?.id
        const otherUserId = envelope.from_user_id === myId ? envelope.to_user_id : envelope.from_user_id
        setContactPresence(otherUserId, true)
        const decrypted = await decryptEnvelope(envelope)
        const activeId = getActiveChatUserId()
        const involvesActive =
          !!activeId &&
          (String(envelope.from_user_id) === String(activeId) ||
            String(envelope.to_user_id) === String(activeId) ||
            String(otherUserId) === String(activeId))
        const isIncomingForInactiveChat = !decrypted.sentBySelf && !involvesActive

        if (involvesActive) {
          appendMessageForActiveChat(decrypted)
        }

        try {
          await saveLocalMessage(conversationKey(otherUserId, myId), decrypted as never)
        } catch (err) {
          console.error('Failed to archive incoming message', err)
        }

        const existingConvo = conversations.value.find((c) => c.contact?.id === otherUserId || c.id === otherUserId)
        let contact = existingConvo?.contact || {
          id: otherUserId,
          username: otherUserId,
          display_name: otherUserId,
        }

        if (!contact.public_key) {
          try {
            const response = await useApi<{ public_key: string }>(
              `/users/${otherUserId}/public-key`,
              { method: 'GET' },
            )
            contact = {
              ...contact,
              public_key: response.public_key,
            }
          } catch (err) {
            console.warn(`[useMessages] Failed to fetch public key for unknown sender ${otherUserId}`, err)
          }
        }

        upsertConversation(contact, {
          lastMessage: {
            id: decrypted.id,
            preview: decrypted.text,
            created_at: decrypted.createdAt,
            sender_id: decrypted.senderId,
          },
          unreadIncrement: isIncomingForInactiveChat ? 1 : 0,
        })

        if (!involvesActive) return
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
    contactPresence.value = {}
  }

  const loadHistory = async (userId: string): Promise<DecryptedMessage[]> => {
    if (!accessToken.value) {
      throw new Error('Not authenticated')
    }

    activeConversationUserId.value = userId
    hasMoreHistory.value = true
    historyCursor.value = null
    const convoKey = conversationKey(userId, getMyId())

    const cached = await getLocalMessages(convoKey)
    if (cached.length > 0) {
      messages.value = cached.slice(-MESSAGE_PAGE_SIZE) as DecryptedMessage[]
    } else {
      messages.value = []
    }

    const cachedIds = new Set(cached.map((m) => m.id))

    try {
      const response = await loadHistoryPage(userId)

      const list = response.messages
      hasMoreHistory.value = !!response.hasMore
      historyCursor.value = response.nextCursor || null

      const fresh = list.filter((env) => !cachedIds.has(env.id))
      if (fresh.length === 0) {
        return messages.value
      }

      const decrypted = await Promise.all(fresh.map((env) => decryptEnvelope(env)))

      await Promise.all(
        decrypted.map((m) => saveLocalMessage(convoKey, m as never)),
      )

      messages.value = mergeMessages(messages.value, decrypted)
      return messages.value
    } catch (err) {
      console.error('Failed to fetch fresh history', err)
      return messages.value
    }
  }

  const loadOlderMessages = async (userId?: string): Promise<DecryptedMessage[]> => {
    const targetUserId = userId || getActiveChatUserId()
    if (!targetUserId || isLoadingOlderMessages.value || !hasMoreHistory.value) {
      return messages.value
    }
    if (!accessToken.value) {
      throw new Error('Not authenticated')
    }

    isLoadingOlderMessages.value = true
    try {
      const response = await loadHistoryPage(targetUserId, { older: true })
      hasMoreHistory.value = !!response.hasMore
      historyCursor.value = response.nextCursor || null

      const existingIds = new Set(messages.value.map((m) => m.id))
      const fresh = response.messages.filter((env) => !existingIds.has(env.id))
      if (fresh.length === 0) {
        if (response.messages.length < MESSAGE_PAGE_SIZE && !response.nextCursor) {
          hasMoreHistory.value = false
        }
        return messages.value
      }

      const decrypted = await Promise.all(fresh.map((env) => decryptEnvelope(env)))
      const convoKey = conversationKey(targetUserId, getMyId())
      await Promise.all(
        decrypted.map((m) => saveLocalMessage(convoKey, m as never)),
      )

      messages.value = mergeMessages(decrypted, messages.value)
      return messages.value
    } catch (err) {
      console.error('Failed to fetch older history', err)
      throw err
    } finally {
      isLoadingOlderMessages.value = false
    }
  }

  const clearMessages = () => {
    messages.value = []
    activeConversationUserId.value = null
    isContactTyping.value = false
    isLoadingOlderMessages.value = false
    hasMoreHistory.value = true
    historyCursor.value = null
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
        const response = await useApi<{ public_key: string }>(
          `/users/${id}/public-key`,
          { method: 'GET' },
        )
        
        const existing = conversations.value.find((c) => (c.contact?.id === id || c.id === id))
        if (existing) {
          conversations.value = conversations.value.map((c) =>
            (c.contact?.id === id || c.id === id)
              ? { ...c, contact: { ...c.contact, public_key: response.public_key }, updated_at: new Date().toISOString() }
              : c
          )
        } else {
          conversations.value = [
            {
              id: `conv-${id}`,
              contact: {
                id,
                username: id,
                display_name: id,
                public_key: response.public_key,
              },
              updated_at: new Date().toISOString(),
            },
            ...conversations.value,
          ]
        }
      } catch (err) {
        console.warn(`[useMessages] Failed to rehydrate public key for ${id}`, err)
        const existing = conversations.value.find((c) => c.contact.id === id)
        if (!existing) {
          conversations.value = [
            {
              id: `conv-${id}`,
              contact: {
                id,
                username: id,
                display_name: id,
              },
              updated_at: new Date().toISOString(),
            },
            ...conversations.value,
          ]
        }
      }
    }
  }

  const ensureOwnPublicKey = async (): Promise<void> => {
    if (getActivePublicKey()) return
    if (!currentUser.value?.public_key) {
      throw new Error('Your public key is missing. Please log in again.')
    }

    await setActivePublicKey(currentUser.value.public_key)
  }

  const normalizeSavedEnvelope = (
    response: EncryptedMessageEnvelope | { message?: EncryptedMessageEnvelope; envelope?: EncryptedMessageEnvelope },
  ): EncryptedMessageEnvelope | null => {
    if ('payload' in response && response.payload) return response as EncryptedMessageEnvelope
    return response.message || response.envelope || null
  }

  const sendEncryptedContent = async (
    toUserId: string,
    content: SendableMessageContent,
    recipientPublicKey: string,
  ): Promise<DecryptedMessage> => {
    if (!content.plaintext) {
      throw new Error('Cannot send an empty message.')
    }
    if (!accessToken.value) {
      throw new Error('Not authenticated')
    }
    if (!recipientPublicKey) {
      throw new Error('Recipient public key missing.')
    }

    await ensureOwnPublicKey()

    const payload = await encryptMessage(content.plaintext, recipientPublicKey)

    const wireBody = {
      to: toUserId,
      payload: {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        encryptedKey: payload.encryptedKey,
        encryptedKeyForSelf: payload.encryptedKeyForSelf,
      },
    }

    const convoKey = conversationKey(toUserId, getMyId())
    const optimistic: DecryptedMessage = {
      id: `local-${Date.now()}`,
      senderId: currentUser.value?.id || 'me',
      recipientId: toUserId,
      text: content.preview,
      kind: content.kind || 'text',
      attachment: content.attachment,
      createdAt: new Date().toISOString(),
      sentBySelf: true,
      status: 'sent',
    }
    messages.value = [...messages.value, optimistic]

    try {
      const response = await useApi<EncryptedMessageEnvelope | { message?: EncryptedMessageEnvelope; envelope?: EncryptedMessageEnvelope }>('/messages', {
        method: 'POST',
        body: wireBody,
      })
      const saved = normalizeSavedEnvelope(response)

      const idx = messages.value.findIndex((m) => m.id === optimistic.id)
      let finalMessage: DecryptedMessage = optimistic
      if (idx !== -1) {
        finalMessage = {
          ...optimistic,
          id: saved?.id || optimistic.id,
          createdAt: saved?.created_at || optimistic.createdAt,
          status: saved?.delivered ? 'delivered' : 'sent',
        }
        const next = [...messages.value]
        next[idx] = finalMessage
        messages.value = next
      }
      await saveLocalMessage(convoKey, finalMessage as never)
      if (activeContact.value) {
        upsertConversation(activeContact.value, {
          lastMessage: {
            id: finalMessage.id,
            preview: finalMessage.text,
            created_at: finalMessage.createdAt,
            sender_id: finalMessage.senderId,
          },
        })
      }
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

  const sendMessage = async (
    toUserId: string,
    plaintext: string,
    recipientPublicKey: string,
  ): Promise<DecryptedMessage> => {
    const trimmed = plaintext.trim()
    return sendEncryptedContent(
      toUserId,
      {
        plaintext: trimmed,
        preview: trimmed,
        kind: 'text',
      },
      recipientPublicKey,
    )
  }

  const sendFileMessage = async (
    toUserId: string,
    file: File,
    recipientPublicKey: string,
  ): Promise<DecryptedMessage> => {
    if (!file) {
      throw new Error('Choose a file to send.')
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error('Files must be smaller than 2 MB.')
    }

    const attachment: MessageAttachment = {
      name: file.name || 'attachment',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      dataBase64: arrayBufferToBase64(await file.arrayBuffer()),
    }
    const encoded: EncodedFileMessage = {
      __yarn_message_type: 'file',
      version: 1,
      file: attachment,
    }

    return sendEncryptedContent(
      toUserId,
      {
        plaintext: JSON.stringify(encoded),
        preview: attachmentPreview(attachment),
        kind: 'file',
        attachment,
      },
      recipientPublicKey,
    )
  }

  return {
    messages,
    ws,
    isConnected,
    contactPresence,
    activeConversationUserId,
    isContactTyping,
    isLoadingOlderMessages,
    hasMoreHistory,
    connectWS,
    disconnectWS,
    loadHistory,
    loadOlderMessages,
    clearMessages,
    sendMessage,
    sendFileMessage,
    sendTypingEvent,
    sendReadReceipt,
    loadSidebar,
  }
}
