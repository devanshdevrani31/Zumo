import { encrypt, decrypt } from '@/lib/secrets'

describe('Secrets Module', () => {
  it('encrypt then decrypt roundtrip returns original plaintext', () => {
    const plaintext = 'super-secret-api-key-12345'
    const ciphertext = encrypt(plaintext)
    const decrypted = decrypt(ciphertext)
    expect(decrypted).toBe(plaintext)
  })

  it('encrypted value is different from plaintext', () => {
    const plaintext = 'another-secret-value'
    const ciphertext = encrypt(plaintext)
    expect(ciphertext).not.toBe(plaintext)
    // Ciphertext should be in format iv:tag:encrypted (hex values separated by colons)
    expect(ciphertext.split(':')).toHaveLength(3)
  })

  it('decrypt of tampered ciphertext throws an error', () => {
    const plaintext = 'do-not-tamper'
    const ciphertext = encrypt(plaintext)
    // Tamper with the encrypted data portion (third segment)
    const parts = ciphertext.split(':')
    parts[2] = 'ff' + parts[2].slice(2)
    const tampered = parts.join(':')

    expect(() => decrypt(tampered)).toThrow()
  })
})
