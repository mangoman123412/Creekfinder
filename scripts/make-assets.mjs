// Generates icon / adaptive icon / splash / favicon PNGs from vector art. Run: npm run assets
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const FOREST = '#1F4D3A', WATER = '#1E88C7', LIGHT = '#DCEFF9';

// A map pin whose body holds flowing creek ribbons.
const glyph = (s = 1) => `
  <g transform="translate(512 512) scale(${s}) translate(-512 -512)">
    <path d="M512 150c-139 0-252 108-252 243 0 175 252 481 252 481s252-306 252-481c0-135-113-243-252-243z" fill="#FFFFFF"/>
    <clipPath id="c"><circle cx="512" cy="390" r="170"/></clipPath>
    <circle cx="512" cy="390" r="170" fill="${WATER}"/>
    <g clip-path="url(#c)" fill="none" stroke-linecap="round">
      <path d="M330 350c60-50 110 50 182 0s122 50 190 0" stroke="${LIGHT}" stroke-width="30"/>
      <path d="M330 430c60-50 110 50 182 0s122 50 190 0" stroke="#FFFFFF" stroke-width="26" opacity=".85"/>
      <path d="M330 510c60-50 110 50 182 0s122 50 190 0" stroke="${LIGHT}" stroke-width="22" opacity=".7"/>
    </g>
  </g>`;
const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E6B52"/><stop offset="1" stop-color="#143528"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;
const svg = (inner, transparent = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${transparent ? '' : bg}${inner}</svg>`;

const out = async (name, markup, size = 1024) => sharp(Buffer.from(markup)).resize(size, size).png().toFile(`assets/${name}`);

await out('icon.png', svg(glyph(1)));                                  // iOS icon (no alpha needed; opaque bg)
await out('adaptive-icon.png', svg(glyph(0.62), true));                // Android foreground (safe zone)
await out('adaptive-icon-mono.png', svg(glyph(0.62).replaceAll(WATER, '#000').replaceAll(LIGHT, '#000').replaceAll('#FFFFFF', '#000'), true));
await out('splash-icon.png', svg(glyph(1), true));
await out('favicon.png', svg(glyph(1)), 96);
writeFileSync('assets/icon.svg', svg(glyph(1)));
console.log('assets written');
