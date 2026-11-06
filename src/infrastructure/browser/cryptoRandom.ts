import type { Random } from '../../application/ports';

/** Aleatoriedade criptográfica do navegador (Web Crypto). O nonce do commit depende disso. */
export const cryptoRandom: Random = {
  next() {
    const [value] = crypto.getRandomValues(new Uint32Array(1));
    return (value ?? 0) / 2 ** 32;
  },

  hex(length) {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  },
};
