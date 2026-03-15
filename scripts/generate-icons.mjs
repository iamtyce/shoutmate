import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const pub = join(__dir, '../public');

const iconSvg = readFileSync(join(pub, 'icon.svg'));
const maskableSvg = readFileSync(join(pub, 'icon-maskable.svg'));

const sizes = [
  { file: 'icon-192.png', svg: iconSvg, size: 192 },
  { file: 'icon-512.png', svg: iconSvg, size: 512 },
  { file: 'icon-maskable-512.png', svg: maskableSvg, size: 512 },
  { file: 'apple-touch-icon.png', svg: iconSvg, size: 180 },
];

for (const { file, svg, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(pub, file));
  console.log(`✓ ${file}`);
}
