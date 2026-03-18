import { v4 as uuidv4 } from 'uuid';

export function makeId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return uuidv4();
}
