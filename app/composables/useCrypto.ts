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

let activePrivateKey: CryptoKey | null = null
let activePublicKey: CryptoKey | null = null

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
  ): Promise<string> => {
    if (!activePrivateKey) {
      throw new Error('Private key not loaded. Please log in to decrypt messages.')
    }

    const wrappedKey = sentBySelf ? payload.encryptedKeyForSelf : payload.encryptedKey
    if (!wrappedKey) {
      throw new Error('Missing encrypted message key for this recipient.')
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

  return {
    generateAccountKeys,
    unwrapAccountPrivateKey,
    importPublicKey,
    setActivePublicKey,
    getActivePrivateKey,
    getActivePublicKey,
    clearActiveKeys,
    encryptMessage,
    decryptMessage,
    arrayBufferToBase64,
    base64ToArrayBuffer,
  }
}
