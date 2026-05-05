const ARCHIVE_DB_NAME = 'yarn-archive'
const ARCHIVE_DB_VERSION = 1
const MESSAGE_STORE = 'messages'
const CONVERSATION_INDEX = 'by_conversation'

interface StoredMessage {
  id: string
  conversationId: string
  senderId: string
  recipientId: string
  text: string
  createdAt: string
  sentBySelf: boolean
  status?: 'sent' | 'delivered' | 'read' | 'failed'
}

const openArchive = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'))
      return
    }

    const request = indexedDB.open(ARCHIVE_DB_NAME, ARCHIVE_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        const store = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' })
        store.createIndex(CONVERSATION_INDEX, 'conversationId', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const useStorage = () => {
  const isAvailable = (): boolean => typeof indexedDB !== 'undefined'

  const saveLocalMessage = async (
    conversationId: string,
    message: StoredMessage | Omit<StoredMessage, 'conversationId'>,
  ): Promise<void> => {
    if (!isAvailable()) return
    if (!message.id) return

    const record: StoredMessage = {
      ...(message as StoredMessage),
      conversationId,
    }

    try {
      const db = await openArchive()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(MESSAGE_STORE, 'readwrite')
        tx.objectStore(MESSAGE_STORE).put(record)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
      db.close()
    } catch (err) {
      console.error('Failed to save message to local archive', err)
    }
  }

  const getLocalMessages = async (conversationId: string): Promise<StoredMessage[]> => {
    if (!isAvailable()) return []
    try {
      const db = await openArchive()
      const items = await new Promise<StoredMessage[]>((resolve, reject) => {
        const tx = db.transaction(MESSAGE_STORE, 'readonly')
        const index = tx.objectStore(MESSAGE_STORE).index(CONVERSATION_INDEX)
        const req = index.getAll(conversationId)
        req.onsuccess = () => resolve((req.result as StoredMessage[]) || [])
        req.onerror = () => reject(req.error)
      })
      db.close()
      return items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    } catch (err) {
      console.error('Failed to read local archive', err)
      return []
    }
  }

  const deleteLocalMessage = async (messageId: string): Promise<void> => {
    if (!isAvailable() || !messageId) return
    try {
      const db = await openArchive()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(MESSAGE_STORE, 'readwrite')
        tx.objectStore(MESSAGE_STORE).delete(messageId)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
      db.close()
    } catch (err) {
      console.error('Failed to delete local message', err)
    }
  }

  const clearLocalArchive = async (): Promise<void> => {
    if (!isAvailable()) return
    try {
      const db = await openArchive()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(MESSAGE_STORE, 'readwrite')
        tx.objectStore(MESSAGE_STORE).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
      db.close()
    } catch (err) {
      console.error('Failed to clear local archive', err)
    }
  }

  return {
    saveLocalMessage,
    getLocalMessages,
    deleteLocalMessage,
    clearLocalArchive,
  }
}

const deleteDatabase = (name: string): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve()
      return
    }
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

export const destroyLocalVault = async (): Promise<void> => {
  if (typeof indexedDB === 'undefined') return
  await Promise.all([
    deleteDatabase(ARCHIVE_DB_NAME),
    deleteDatabase('yarn-vault'),
  ])
}
