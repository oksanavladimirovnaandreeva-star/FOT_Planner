import fs from "fs";

const path = process.argv[2];
if (!path) process.exit(1);

let s = fs.readFileSync(path, "utf8");

/** UTF-8 bytes were read as Windows-1251 and saved as UTF-8 again. */
function demojibake(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0xff) {
      out.push(code);
      continue;
    }
    const table = CP1251_UNICODE_TO_BYTE;
    const byte = table[code];
    if (byte === undefined) return null;
    out.push(byte);
  }
  try {
    return Buffer.from(out).toString("utf8");
  } catch {
    return null;
  }
}

const CP1251_UNICODE_TO_BYTE = (() => {
  const map = {};
  for (let b = 0x80; b <= 0xff; b++) {
    const ch = Buffer.from([b]).toString("win1251" in Buffer.prototype ? "win1251" : "latin1");
    // Build from known cp1251 cyrillic block
  }
  const pairs = [
    [0x410, 0xc0], [0x411, 0xc1], [0x412, 0xc2], [0x413, 0xc3], [0x414, 0xc4], [0x415, 0xc5],
    [0x416, 0xc6], [0x417, 0xc7], [0x418, 0xc8], [0x419, 0xc9], [0x41a, 0xca], [0x41b, 0xcb],
    [0x41c, 0xcc], [0x41d, 0xcd], [0x41e, 0xce], [0x41f, 0xcf], [0x420, 0xd0], [0x421, 0xd1],
    [0x422, 0xd2], [0x423, 0xd3], [0x424, 0xd4], [0x425, 0xd5], [0x426, 0xd6], [0x427, 0xd7],
    [0x428, 0xd8], [0x429, 0xd9], [0x42a, 0xda], [0x42b, 0xdb], [0x42c, 0xdc], [0x42d, 0xdd],
    [0x42e, 0xde], [0x42f, 0xdf], [0x430, 0xe0], [0x431, 0xe1], [0x432, 0xe2], [0x433, 0xe3],
    [0x434, 0xe4], [0x435, 0xe5], [0x436, 0xe6], [0x437, 0xe7], [0x438, 0xe8], [0x439, 0xe9],
    [0x43a, 0xea], [0x43b, 0xeb], [0x43c, 0xec], [0x43d, 0xed], [0x43e, 0xee], [0x43f, 0xef],
    [0x440, 0xf0], [0x441, 0xf1], [0x442, 0xf2], [0x443, 0xf3], [0x444, 0xf4], [0x445, 0xf5],
    [0x446, 0xf6], [0x447, 0xf7], [0x448, 0xf8], [0x449, 0xf9], [0x44a, 0xfa], [0x44b, 0xfb],
    [0x44c, 0xfc], [0x44d, 0xfd], [0x44e, 0xfe], [0x44f, 0xff],
    [0x401, 0xa8], [0x451, 0xb8], [0x2116, 0xb9], [0x2014, 0x97], [0x2013, 0x96],
    [0x20ac, 0x88], [0x2116, 0xb9],
  ];
  const m = {};
  for (const [uni, byte] of pairs) m[uni] = byte;
  return m;
})();

function fixSegment(inner) {
  if (!/Р/.test(inner) && !/вЂ/.test(inner) && !/в‚/.test(inner)) return inner;
  const fixed = demojibake(inner);
  return fixed && /[А-Яа-яЁё]/.test(fixed) ? fixed : inner;
}

s = s.replace(/"([^"]+)"/g, (m, inner) => {
  if (inner.length < 4) return m;
  const fixed = fixSegment(inner);
  return fixed === inner ? m : `"${fixed}"`;
});
s = s.replace(/`([^`]+)`/g, (m, inner) => {
  if (!/Р|вЂ|в‚|СЃР/.test(inner)) return m;
  const fixed = fixSegment(inner);
  return fixed === inner ? m : `\`${fixed}\``;
});
s = s.replace(/>([^<\n]{2,})</g, (m, inner) => {
  const t = inner.trim();
  if (!/Р|вЂ/.test(t) || t.includes("{")) return m;
  const fixed = fixSegment(t);
  if (fixed === t) return m;
  const lead = inner.match(/^\s*/)?.[0] ?? "";
  const trail = inner.match(/\s*$/)?.[0] ?? "";
  return `>${lead}${fixed}${trail}<`;
});

fs.writeFileSync(path, s, "utf8");
const left = (s.match(/Р[Ђ-я]/g) || []).length;
console.log("Fixed:", path, "remaining suspicious:", left);
