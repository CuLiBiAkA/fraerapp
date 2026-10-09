// Re-encode artwork without resizing or changing visible pixels/transparency.
// Run with sharp available in NODE_PATH; originals remain the editable source.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');

(async () => {
  let before = 0, after = 0;
  for (const name of ['cosmos', 'settings-neon', 'account-neon', 'search-neon', 'arrow-neon', 'cookie-magic', 'loading-fairy']) {
    const source = path.join(__dirname, '../frontend/assets/home', name + '.png');
    const target = source.replace(/\.png$/, '.webp');
    const encoded = await sharp(source).webp({ lossless: true, effort: 6 }).toBuffer();
    const originalPixels = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const encodedPixels = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(encodedPixels.info, originalPixels.info, name + ': dimensions and pixel format');
    for (let i = 0; i < originalPixels.data.length; i += 4) {
      assert.equal(encodedPixels.data[i + 3], originalPixels.data[i + 3], name + ': alpha differs');
      // WebP may normalize hidden RGB values at alpha=0; these never render.
      if (originalPixels.data[i + 3]) {
        assert.ok(encodedPixels.data.subarray(i, i + 3).equals(originalPixels.data.subarray(i, i + 3)), name + ': visible pixels differ');
      }
    }
    const originalSize = fs.statSync(source).size;
    assert.ok(encoded.length < originalSize, name + ': encoding must save bytes');
    fs.writeFileSync(target, encoded);
    before += originalSize; after += encoded.length;
    console.log(name + ': ' + originalSize + ' → ' + encoded.length + ' bytes, visible pixels and alpha identical');
  }
  console.log('Total: ' + before + ' → ' + after + ' bytes (' + Math.round((1 - after / before) * 100) + '% smaller)');
})().catch(error => { console.error(error); process.exitCode = 1; });
