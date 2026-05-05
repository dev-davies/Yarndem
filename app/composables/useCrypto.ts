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

const padBuffer = (buffer: ArrayBuffer): ArrayBuffer => {
  const paddingLength = 8 - (buffer.byteLength % 8)
  const padded = new Uint8Array(buffer.byteLength + paddingLength)
  padded.set(new Uint8Array(buffer))
  for (let i = 0; i < paddingLength; i++) {
    padded[buffer.byteLength + i] = paddingLength
  }
  return padded.buffer
}

const unpadBuffer = (buffer: ArrayBuffer): ArrayBuffer => {
  const bytes = new Uint8Array(buffer)
  const paddingLength = bytes[bytes.length - 1]
  return bytes.buffer.slice(0, bytes.length - paddingLength)
}

export interface GeneratedAccountKeys {
  publicKeyBase64: string
  wrappedPrivateKeyBase64: string
  pbkdf2SaltBase64: string
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
      { name: 'AES-KW', length: 256 },
      false,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
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

    const wrappingKey = await deriveWrappingKey(password, salt)

    const exportedPrivateKey = await window.crypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey,
    )

    const paddedKey = padBuffer(exportedPrivateKey)

    const wrappedKeyBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-KW' },
      wrappingKey,
      paddedKey,
    )

    const publicKeySpki = await subtle().exportKey('spki', keyPair.publicKey)

    return {
      publicKeyBase64: arrayBufferToBase64(publicKeySpki),
      wrappedPrivateKeyBase64: arrayBufferToBase64(wrappedKeyBuffer),
      pbkdf2SaltBase64: arrayBufferToBase64(salt.buffer),
    }
  }

  return {
    generateAccountKeys,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    padBuffer,
    unpadBuffer,
  }
}
