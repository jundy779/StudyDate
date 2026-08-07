import "server-only";

export {
  CONTACT_REVEAL_DEFAULT_KEY_VERSION,
  decryptContactValue,
  encryptContactValue,
  getContactRevealCurrentKeyVersion,
  isContactRevealKeyConfigured,
  isContactRevealKeyVersionConfigured,
  KEY_ENV,
  KEY_VERSION_ENV,
  normalizeByteaInput,
  resolveContactRevealKeyMaterial,
  type ContactEncryptedValue,
} from "@/lib/contact-reveal/crypto-core";

/** @deprecated Prefer CONTACT_REVEAL_DEFAULT_KEY_VERSION / getContactRevealCurrentKeyVersion() */
export { CONTACT_REVEAL_DEFAULT_KEY_VERSION as CONTACT_REVEAL_KEY_VERSION } from "@/lib/contact-reveal/crypto-core";
