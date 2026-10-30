/**
 * Prefix packing for sorted word lists: each word is one char for the length of the prefix it shares
 * with the previous word ('0' + n), then the rest of the word. The digit chars double as separators.
 */
export function pack(sorted: readonly string[]): string {
  let prev = "";
  let out = "";
  for (const w of sorted) {
    let p = 0;
    const max = Math.min(prev.length, w.length, 40);
    while (p < max && prev[p] === w[p]) p++;
    out += String.fromCharCode(48 + p) + w.slice(p);
    prev = w;
  }
  return out;
}

export function unpack(packed: string): string[] {
  const words: string[] = [];
  let prev = "";
  let i = 0;
  while (i < packed.length) {
    const p = packed.charCodeAt(i) - 48;
    let j = i + 1;
    while (j < packed.length && packed.charCodeAt(j) >= 97) j++;
    prev = prev.slice(0, p) + packed.slice(i + 1, j);
    words.push(prev);
    i = j;
  }
  return words;
}
