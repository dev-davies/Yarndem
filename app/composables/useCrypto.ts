function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return window.btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

const IV_LENGTH = 12

const VAULT_DB_NAME = 'yarn-vault'
const VAULT_STORE_NAME = 'session-keys'
const VAULT_DB_VERSION = 1
const PRIVATE_KEY_RECORD = 'active-private-key'
const PUBLIC_KEY_RECORD = 'active-public-key'

let activePrivateKey: CryptoKey | null = null
let activePublicKey: CryptoKey | null = null

const openVault = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'))
      return
    }

    const request = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        db.createObjectStore(VAULT_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const vaultPut = async (key: string, value: CryptoKey): Promise<void> => {
  const db = await openVault()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite')
    tx.objectStore(VAULT_STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

const vaultGet = async (key: string): Promise<CryptoKey | null> => {
  const db = await openVault()
  const value = await new Promise<CryptoKey | null>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readonly')
    const req = tx.objectStore(VAULT_STORE_NAME).get(key)
    req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return value
}

const vaultClear = async (): Promise<void> => {
  if (typeof indexedDB === 'undefined') return
  const db = await openVault()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite')
    tx.objectStore(VAULT_STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

export interface GeneratedAccountKeys {
  publicKeyBase64: string
  wrappedPrivateKeyBase64: string
  pbkdf2SaltBase64: string
}

export interface EncryptedMessagePayload {
  ciphertext: string
  iv: string
  encryptedKey: string
  encryptedKeyForSelf: string
}

export interface EncryptedFileResult {
  ciphertextBase64: string
  aesKey: CryptoKey
  iv: Uint8Array
  mimeType: string
  name: string
  size: number
}

export const useCrypto = () => {
  const subtle = (): SubtleCrypto => {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      throw new Error('Web Crypto API is not available in this environment.')
    }
    return window.crypto.subtle
  }

  const deriveWrappingKey = async (
    password: string,
    salt: Uint8Array,
  ): Promise<CryptoKey> => {
    const passwordKey = await subtle().importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    )

    return subtle().deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100_000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey'],
    )
  }

  const generateAccountKeys = async (
    password: string,
  ): Promise<GeneratedAccountKeys> => {
    const keyPair = (await subtle().generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
    )) as CryptoKeyPair

    const salt = window.crypto.getRandomValues(new Uint8Array(16))
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    const wrappingKey = await deriveWrappingKey(password, salt)

    const wrappedPrivateKey = await subtle().wrapKey(
      'pkcs8',
      keyPair.privateKey,
      wrappingKey,
      { name: 'AES-GCM', iv },
    )

    const wrappedBytes = new Uint8Array(wrappedPrivateKey)
    const combined = new Uint8Array(iv.byteLength + wrappedBytes.byteLength)
    combined.set(iv, 0)
    combined.set(wrappedBytes, iv.byteLength)

    const publicKeySpki = await subtle().exportKey('spki', keyPair.publicKey)

    activePrivateKey = keyPair.privateKey
    activePublicKey = keyPair.publicKey

    return {
      publicKeyBase64: arrayBufferToBase64(publicKeySpki),
      wrappedPrivateKeyBase64: arrayBufferToBase64(combined.buffer),
      pbkdf2SaltBase64: arrayBufferToBase64(salt.buffer),
    }
  }

  const unwrapAccountPrivateKey = async (
    password: string,
    wrappedPrivateKeyBase64: string,
    pbkdf2SaltBase64: string,
    publicKeyBase64?: string,
  ): Promise<CryptoKey> => {
    const salt = new Uint8Array(base64ToArrayBuffer(pbkdf2SaltBase64))
    const combined = new Uint8Array(base64ToArrayBuffer(wrappedPrivateKeyBase64))

    if (combined.byteLength <= IV_LENGTH) {
      throw new Error('Wrapped private key payload is malformed.')
    }

    const iv = combined.slice(0, IV_LENGTH)
    const ciphertext = combined.slice(IV_LENGTH)

    const wrappingKey = await deriveWrappingKey(password, salt)

    const privateKey = await subtle().unwrapKey(
      'pkcs8',
      ciphertext,
      wrappingKey,
      { name: 'AES-GCM', iv },
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['decrypt', 'unwrapKey'],
    )

    activePrivateKey = privateKey

    if (publicKeyBase64) {
      activePublicKey = await importPublicKey(publicKeyBase64)
    }

    return privateKey
  }

  const importPublicKey = async (publicKeyBase64: string): Promise<CryptoKey> => {
    return subtle().importKey(
      'spki',
      base64ToArrayBuffer(publicKeyBase64),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['encrypt', 'wrapKey'],
    )
  }

  const setActivePublicKey = async (publicKeyBase64: string): Promise<void> => {
    activePublicKey = await importPublicKey(publicKeyBase64)
  }

  const getActivePrivateKey = (): CryptoKey | null => activePrivateKey
  const getActivePublicKey = (): CryptoKey | null => activePublicKey

  const clearActiveKeys = (): void => {
    activePrivateKey = null
    activePublicKey = null
  }

  const storeSessionKey = async (
    privateKey: CryptoKey,
    publicKey?: CryptoKey,
  ): Promise<void> => {
    if (typeof indexedDB === 'undefined') return
    try {
      await vaultPut(PRIVATE_KEY_RECORD, privateKey)
      if (publicKey) {
        await vaultPut(PUBLIC_KEY_RECORD, publicKey)
      } else if (activePublicKey) {
        await vaultPut(PUBLIC_KEY_RECORD, activePublicKey)
      }
    } catch (err) {
      console.error('Failed to persist session key to vault', err)
    }
  }

  const retrieveSessionKey = async (): Promise<CryptoKey | null> => {
    if (typeof indexedDB === 'undefined') return null
    try {
      const privateKey = await vaultGet(PRIVATE_KEY_RECORD)
      if (privateKey) {
        activePrivateKey = privateKey
      }
      const publicKey = await vaultGet(PUBLIC_KEY_RECORD)
      if (publicKey) {
        activePublicKey = publicKey
      }
      return privateKey
    } catch (err) {
      console.error('Failed to retrieve session key from vault', err)
      return null
    }
  }

  const clearSessionKey = async (): Promise<void> => {
    activePrivateKey = null
    activePublicKey = null
    try {
      await vaultClear()
    } catch (err) {
      console.error('Failed to clear vault', err)
    }
  }

  const encryptMessage = async (
    plaintext: string,
    recipientPublicKeyBase64: string,
  ): Promise<EncryptedMessagePayload> => {
    if (!activePublicKey) {
      throw new Error('Your own public key is not loaded. Please log in again.')
    }

    const messageKey = await subtle().generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )

    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    const ciphertext = await subtle().encrypt(
      { name: 'AES-GCM', iv },
      messageKey,
      new TextEncoder().encode(plaintext),
    )

    const rawMessageKey = await subtle().exportKey('raw', messageKey)

    const recipientKey = await importPublicKey(recipientPublicKeyBase64)

    const [encryptedKey, encryptedKeyForSelf] = await Promise.all([
      subtle().encrypt({ name: 'RSA-OAEP' }, recipientKey, rawMessageKey),
      subtle().encrypt({ name: 'RSA-OAEP' }, activePublicKey, rawMessageKey),
    ])

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
      encryptedKey: arrayBufferToBase64(encryptedKey),
      encryptedKeyForSelf: arrayBufferToBase64(encryptedKeyForSelf),
    }
  }

  const decryptMessage = async (
    payload: EncryptedMessagePayload,
    sentBySelf: boolean,
    messageId?: string,
  ): Promise<string> => {
    const keyField = sentBySelf ? 'encryptedKeyForSelf' : 'encryptedKey'
    
    console.log(`[useCrypto] Decrypting message ${messageId || 'unknown'}:`, {
      sentBySelf,
      useKeyField: keyField,
      hasActivePrivateKey: !!activePrivateKey,
      payloadKeys: {
        hasEncKey: !!payload.encryptedKey,
        hasEncKeySelf: !!payload.encryptedKeyForSelf
      }
    })

    if (!activePrivateKey) {
      throw new Error('Private key not loaded. Please log in to decrypt messages.')
    }

    const wrappedKey = sentBySelf ? payload.encryptedKeyForSelf : payload.encryptedKey
    if (!wrappedKey) {
      throw new Error(`Missing ${keyField} in payload.`)
    }

    const rawMessageKey = await subtle().decrypt(
      { name: 'RSA-OAEP' },
      activePrivateKey,
      base64ToArrayBuffer(wrappedKey),
    )

    const messageKey = await subtle().importKey(
      'raw',
      rawMessageKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )

    const plaintextBuffer = await subtle().decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(payload.iv) },
      messageKey,
      base64ToArrayBuffer(payload.ciphertext),
    )

    return new TextDecoder().decode(plaintextBuffer)
  }

  const encryptFile = async (file: File): Promise<EncryptedFileResult> => {
    const buffer = await file.arrayBuffer()

    const aesKey = await subtle().generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )

    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    const ciphertext = await subtle().encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      buffer,
    )

    return {
      ciphertextBase64: arrayBufferToBase64(ciphertext),
      aesKey,
      iv,
      mimeType: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
    }
  }

  const decryptFile = async (
    encryptedBase64: string,
    aesKey: CryptoKey,
    iv: Uint8Array,
    mimeType: string,
  ): Promise<string> => {
    const ciphertext = base64ToArrayBuffer(encryptedBase64)

    const plaintext = await subtle().decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext,
    )

    const blob = new Blob([plaintext], { type: mimeType || 'application/octet-stream' })
    return URL.createObjectURL(blob)
  }

  const exportRawAesKey = async (key: CryptoKey): Promise<ArrayBuffer> => {
    return subtle().exportKey('raw', key)
  }

  const importRawAesKey = async (raw: ArrayBuffer): Promise<CryptoKey> => {
    return subtle().importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )
  }

  const wrapAesKeyForRecipients = async (
    aesKey: CryptoKey,
    recipientPublicKeyBase64: string,
  ): Promise<{ encryptedKey: string; encryptedKeyForSelf: string }> => {
    if (!activePublicKey) {
      throw new Error('Your own public key is not loaded. Please log in again.')
    }
    const rawAesKey = await exportRawAesKey(aesKey)
    const recipientKey = await importPublicKey(recipientPublicKeyBase64)

    const [encryptedKey, encryptedKeyForSelf] = await Promise.all([
      subtle().encrypt({ name: 'RSA-OAEP' }, recipientKey, rawAesKey),
      subtle().encrypt({ name: 'RSA-OAEP' }, activePublicKey, rawAesKey),
    ])

    return {
      encryptedKey: arrayBufferToBase64(encryptedKey),
      encryptedKeyForSelf: arrayBufferToBase64(encryptedKeyForSelf),
    }
  }

  const unwrapAesKey = async (
    wrappedBase64: string,
  ): Promise<CryptoKey> => {
    if (!activePrivateKey) {
      throw new Error('Private key not loaded. Please log in to decrypt.')
    }
    const rawAesKey = await subtle().decrypt(
      { name: 'RSA-OAEP' },
      activePrivateKey,
      base64ToArrayBuffer(wrappedBase64),
    )
    return importRawAesKey(rawAesKey)
  }

  return {
    generateAccountKeys,
    unwrapAccountPrivateKey,
    importPublicKey,
    setActivePublicKey,
    getActivePrivateKey,
    getActivePublicKey,
    clearActiveKeys,
    storeSessionKey,
    retrieveSessionKey,
    clearSessionKey,
    encryptMessage,
    decryptMessage,
    encryptFile,
    decryptFile,
    wrapAesKeyForRecipients,
    unwrapAesKey,
    arrayBufferToBase64,
    base64ToArrayBuffer,
  }
}
