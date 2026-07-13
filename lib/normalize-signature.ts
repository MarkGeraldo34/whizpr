// secp256k1 curve order, and its half — used to detect non-canonical `s` values.
const SECP256K1_N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const SECP256K1_HALF_N = SECP256K1_N / 2n;

/**
 * Some wallets (notably several WalletConnect-connected mobile wallets) return
 * ECDSA signatures with a non-canonical `s` value (s > n/2). This is valid per
 * the raw secp256k1 math — either (r, s) or (r, n - s) recovers the same
 * signer — but ethers v6 rejects non-canonical signatures by default
 * (EIP-2 malleability protection), throwing "non-canonical s; use ._s".
 *
 * This normalizes a 65-byte hex signature (r || s || v) to canonical form so
 * verification doesn't reject otherwise-valid signatures from real wallets.
 */
export function normalizeSignature(signature: string): string {
  const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
  if (hex.length !== 130) {
    // Not a standard 65-byte r|s|v signature — leave it untouched and let
    // the underlying library surface its own error.
    return signature;
  }

  const r = hex.slice(0, 64);
  const sHex = hex.slice(64, 128);
  let v = parseInt(hex.slice(128, 130), 16);

  let s = BigInt('0x' + sHex);

  if (s > SECP256K1_HALF_N) {
    s = SECP256K1_N - s;
    // Flipping s to its canonical counterpart also flips the recovery bit.
    if (v === 27) v = 28;
    else if (v === 28) v = 27;
    else if (v === 0) v = 1;
    else if (v === 1) v = 0;
  }

  const sNormalized = s.toString(16).padStart(64, '0');
  const vHex = v.toString(16).padStart(2, '0');

  return `0x${r}${sNormalized}${vHex}`;
}

