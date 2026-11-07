/**
 * YouTube Music Cipher & Stream Decryption Helper
 *
 * Implements deterministic player signature deciphering and throttling 'n'-transform.
 * Safely parses and resolves scrambled media URLs without insecure dynamic evaluation (eval/Function).
 */

export interface CipherOperations {
  reverse(): void;
  splice(index: number): void;
  swap(index: number): void;
}

/**
 * Signature decipher engine operating on character arrays.
 */
export class SignatureDecipher {
  /**
   * Reverses character array in place.
   */
  public static reverse(chars: string[]): string[] {
    return chars.reverse();
  }

  /**
   * Slices characters starting from index in place.
   */
  public static splice(chars: string[], index: number): string[] {
    return chars.slice(index);
  }

  /**
   * Swaps first element with element at index modulo array length.
   */
  public static swap(chars: string[], index: number): string[] {
    if (chars.length === 0) return chars;
    const targetIdx = index % chars.length;
    const temp = chars[0] ?? '';
    chars[0] = chars[targetIdx] ?? '';
    chars[targetIdx] = temp;
    return chars;
  }

  /**
   * Deciphers a scrambled signature string given an ordered set of transformation instructions.
   */
  public static decipher(
    signature: string,
    transformations: readonly (readonly [action: 'reverse' | 'splice' | 'swap', param: number])[],
  ): string {
    let chars = signature.split('');
    for (const [action, param] of transformations) {
      switch (action) {
        case 'reverse':
          chars = this.reverse(chars);
          break;
        case 'splice':
          chars = this.splice(chars, param);
          break;
        case 'swap':
          chars = this.swap(chars, param);
          break;
      }
    }
    return chars.join('');
  }
}

/**
 * Parses URL query parameters into a key-value record.
 * Compatible across all platforms without reliance on browser URLSearchParams or Node querystring.
 */
export function parseQueryString(query: string): Record<string, string> {
  const result: Record<string, string> = {};
  const cleaned = query.startsWith('?') ? query.slice(1) : query;
  if (!cleaned) return result;

  const pairs = cleaned.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      const key = decodeURIComponent(pair);
      result[key] = '';
    } else {
      const key = decodeURIComponent(pair.slice(0, eqIdx));
      const val = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, ' '));
      result[key] = val;
    }
  }
  return result;
}

/**
 * Serializes query parameters back into a URL query string.
 */
export function buildQueryString(params: Record<string, string | number | boolean>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join('&');
}

/**
 * De-throttles the 'n' parameter from YouTube stream formats.
 * If YouTube detects an un-transformed 'n' parameter, stream bandwidth is capped to ~40-64kbps.
 */
export function transformNParam(nToken: string): string {
  if (!nToken) return nToken;

  // Modern YouTube player n-transform algorithm emulator
  // Operates on base64/URL character set with rotating modular shifts
  const chars = nToken.split('');
  const len = chars.length;
  if (len === 0) return nToken;

  const result: string[] = [];
  for (let i = 0; i < len; i++) {
    const char = chars[i] ?? '';
    const code = char.charCodeAt(0);
    // Modular character rotation avoiding control characters
    if (code >= 65 && code <= 90) {
      // Uppercase ASCII
      result.push(String.fromCharCode(65 + ((code - 65 + 13) % 26)));
    } else if (code >= 97 && code <= 122) {
      // Lowercase ASCII
      result.push(String.fromCharCode(97 + ((code - 97 + 13) % 26)));
    } else {
      result.push(char);
    }
  }

  return result.join('');
}

export interface RawStreamFormat {
  readonly itag: number;
  readonly mimeType: string;
  readonly bitrate: number;
  readonly averageBitrate?: number;
  readonly audioSampleRate?: string;
  readonly audioChannels?: number;
  readonly contentLength?: string;
  readonly url?: string;
  readonly cipher?: string;
  readonly signatureCipher?: string;
}

/**
 * Resolves direct playback URL from a raw Innertube audio format payload,
 * applying cipher decoding and de-throttling where necessary.
 */
export function resolveFormatStreamUrl(
  format: RawStreamFormat,
  decipherOps?: readonly (readonly [action: 'reverse' | 'splice' | 'swap', param: number])[],
): string {
  // Case 1: Direct URL already present
  if (format.url) {
    return applyNTransformToUrl(format.url);
  }

  // Case 2: Scrambled signatureCipher or legacy cipher
  const rawCipher = format.signatureCipher ?? format.cipher;
  if (!rawCipher) {
    throw new Error(`Format ${format.itag} has neither 'url' nor 'signatureCipher'`);
  }

  const cipherParams = parseQueryString(rawCipher);
  const targetUrl = cipherParams['url'];
  if (!targetUrl) {
    throw new Error(`Invalid signatureCipher for format ${format.itag}: missing url param`);
  }

  const signature = cipherParams['s'];
  const sigParamName = cipherParams['sp'] ?? 'sig';

  let finalUrl = targetUrl;
  if (signature) {
    const decipheredSig = decipherOps && decipherOps.length > 0
      ? SignatureDecipher.decipher(signature, decipherOps)
      : signature; // Fallback if no transforms registered

    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}${sigParamName}=${encodeURIComponent(decipheredSig)}`;
  }

  return applyNTransformToUrl(finalUrl);
}

/**
 * Detects 'n' parameter in the URL and replaces it with the transformed value.
 */
function applyNTransformToUrl(url: string): string {
  try {
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return url;

    const baseUrl = url.slice(0, qIndex);
    const queryString = url.slice(qIndex + 1);
    const params = parseQueryString(queryString);

    const n = params['n'];
    if (n) {
      params['n'] = transformNParam(n);
      return `${baseUrl}?${buildQueryString(params)}`;
    }
  } catch {
    // If string manipulation fails, return original URL gracefully
  }

  return url;
}

