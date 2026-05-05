🔒 YarnDem
A Zero-Knowledge, End-to-End Encrypted (E2EE) Real-Time Messaging Platform.

YarnDem is a highly secure web application built with Nuxt 3. It provides real-time chat capabilities while ensuring that the server relaying the messages has strictly zero knowledge of the message contents. Cryptography is handled entirely client-side using the native Web Crypto API.

🏗 System Architecture
YarnDem utilizes a decoupled architecture where a lightweight Node/Express backend (WhisperBox) acts only as a dumb relay and static storage bucket. All cryptographic operations, key generation, and data rendering happen exclusively within the client's browser.

Code snippet
graph TD
    subgraph Client [Browser Environment / Web Crypto API]
        UI[Vue UI Components]
        State[Pinia / Nuxt State]
        IDB[(IndexedDB Local Vault)]
        CryptoEngine[AES-GCM / RSA-OAEP Engine]
    end

    subgraph Server [Zero-Knowledge Backend]
        DB[(PostgreSQL)]
        Auth[JWT Auth & Bcrypt]
        WS[WebSocket Relay]
    end

    UI <--> State
    State <--> CryptoEngine
    CryptoEngine <--> IDB
    CryptoEngine -- Encrypted Payloads Only --> WS
    WS -- Encrypted Payloads Only --> CryptoEngine
    Auth <--> CryptoEngine
🔐 Encryption Flow
YarnDem implements a hybrid cryptographic model, combining the speed of symmetric encryption with the secure distribution of asymmetric keys.

Authentication & Key Generation:
Upon registration, the client generates an RSA-OAEP keypair. The public key is uploaded to the server as plaintext. The private key is wrapped (encrypted) using an AES key derived from the user's password (via PBKDF2) and then uploaded. The server never sees the raw private key or the plaintext password.

Sending a Message:

The client generates a random, ephemeral AES-GCM key for the specific message or file payload.

The payload (text or Base64 file) is encrypted using this ephemeral AES-GCM key.

The ephemeral AES-GCM key is then encrypted using the recipient's Public RSA Key.

Both the encrypted payload and the wrapped AES key are bundled into a JSON packet and sent over secure WebSockets (wss://).

Receiving a Message:

The recipient receives the encrypted JSON packet.

The client uses the recipient's Private RSA Key (unwrapped locally in memory upon login) to decrypt the ephemeral AES key.

The client uses the decrypted AES key to unwrap the AES-GCM payload, revealing the plaintext message.

🔑 Key & State Management
Handling keys securely in a browser environment requires strict isolation to prevent leaks on page refreshes or cross-site scripting (XSS) attacks.

Public Keys: Treated as public identity documents. Stored on the server and cached in memory when opening a chat with a new contact.

Private Keys: The unwrapped private key exists only in volatile memory and a short-lived IndexedDB session vault. It is rehydrated automatically on page refresh but is completely destroyed upon logout.

The Local Archive: To save server bandwidth and prevent battery-draining CPU usage, decrypted message history is cached in the browser's IndexedDB. The app syncs with the server via a deduplication filter, only running the AES decryption math on genuinely new messages.

The Kill Switch: Clicking "Logout" triggers a localized scorched-earth protocol. It drops the server session, clears all authentication cookies, and instantly drops the entire IndexedDB database, leaving zero trace of the chat history or private keys on the device.

⚖️ Security Trade-Offs
Building E2EE for the web involves specific architectural compromises:

Browser Environment Risks: Because the app is delivered via the web (rather than a compiled, signed binary from an App Store), it is theoretically vulnerable to XSS or compromised Vercel builds. A malicious script injected into the DOM could read the unwrapped private key from memory.

Metadata is Unencrypted: The backend relies on routing metadata (Sender ID, Recipient ID, Timestamps, and 'Typing' events). The server knows who is talking to whom and when, even though it cannot read what is being said.

Lack of Perfect Forward Secrecy (PFS): In this MVP, we use static RSA keypairs for asymmetric encryption. If a user's private key is ever compromised, any previously intercepted historical messages could theoretically be decrypted. (A V2 would implement the Double Ratchet Algorithm).

🚧 Known Limitations
File Attachments: Because the backend lacks a dedicated AWS S3/blob storage integration, file attachments are converted to Base64 strings, encrypted via AES, and sent directly through the WebSocket. File sizes are strictly limited to < 2MB to prevent socket connection drops and browser memory overflow.

Account Recovery: The architecture is strictly zero-knowledge. There is no "Forgot Password" feature. If a user loses their password, their encrypted private key blob on the server cannot be unwrapped, and their entire account and message history is permanently unrecoverable.

1-to-1 Only: The current cryptographic exchange is designed strictly for peer-to-peer messaging. Group chats are not currently supported, as encrypting a single payload multiple times for multiple public keys degrades performance linearly.