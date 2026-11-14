// Checks for release/index.html, the standalone bundle that GitHub Pages serves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('release/index.html', root), 'utf8');
const policy = await readFile(new URL('.githooks/pre-commit', root), 'utf8');
const identifiers = new RegExp(policy.match(/^PATTERN='([^']+)'/m)[1], 'i');

// Same format the bundle's own unpackPortfolioData reads: 4-byte length, then literal runs and back-references.
function unpack(encoded) {
  const input = Buffer.from(encoded, 'base64');
  const length = input.readUInt32BE(0);
  const output = Buffer.alloc(length);
  let cursor = 4, written = 0;
  while (cursor < input.length && written < length) {
    const tag = input[cursor++];
    if (tag < 128) {
      input.copy(output, written, cursor, cursor + tag + 1);
      cursor += tag + 1; written += tag + 1;
    } else {
      const count = (tag & 127) + 3;
      const offset = input[cursor++] * 256 + input[cursor++];
      assert.ok(offset > 0 && offset <= written, 'packed data has a bad back-reference');
      for (let i = 0; i < count; i++) { output[written] = output[written - offset]; written++; }
    }
  }
  assert.equal(written, length, 'packed data is truncated');
  return output.toString('utf8');
}

const packed = [...html.matchAll(/unpackPortfolioData\("([A-Za-z0-9+/=]+)"\)/g)].map(match => match[1]);
const gzipped = [...html.matchAll(/atob\("([A-Za-z0-9+/=]{2000,})"\)/g)].map(match => match[1]);
const unpackedText = [
  ...packed.map(unpack),
  ...gzipped.map(blob => gunzipSync(Buffer.from(blob, 'base64')).toString('utf8')),
].join('\n');
const pageText = html
  .replace(/unpackPortfolioData\("[A-Za-z0-9+/=]+"\)/g, '')
  .replace(/atob\("[A-Za-z0-9+/=]{2000,}"\)/g, '')
  .replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, '');

test('release bundle stays under 1.2 MB', () => {
  assert.ok(Buffer.byteLength(html) < 1_200_000, `release/index.html is ${Buffer.byteLength(html)} bytes`);
});

test('release bundle is one self-contained file', () => {
  assert.match(html, /<title>Alexis Martinez — AXO World<\/title>/);
  assert.equal([...html.matchAll(/<script\b/g)].length, 1, 'exactly one inline script');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i, 'no external scripts');
  assert.doesNotMatch(html, /<link\b[^>]*rel=["']?stylesheet/i, 'no external stylesheets');
  assert.doesNotMatch(html, /<(?:img|source|video|audio|iframe)\b[^>]*\bsrc=["'](?!data:)/i, 'no external media');
  assert.doesNotMatch(pageText, /\bfetch\(|XMLHttpRequest|new WebSocket\(|sendBeacon\(|\bimport\(/, 'no runtime network calls');
});

test('release bundle packed data unpacks to valid JSON', () => {
  assert.ok(packed.length >= 1, 'expected packed portfolio data');
  for (const blob of packed) JSON.parse(unpack(blob));
});

test('release bundle text holds no internal identifiers and never names the employer', () => {
  for (const [label, text] of [['page', pageText], ['unpacked data', unpackedText]]) {
    assert.doesNotMatch(text, identifiers, `${label} matches the identifier blocklist`);
    assert.doesNotMatch(text, /\bHP\b|Hewlett/, `${label} names the employer`);
  }
});
