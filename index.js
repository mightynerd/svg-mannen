#!/usr/bin/env node
import Yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
import * as fs from 'fs';
import * as SVG from 'svgson';
import ImageMin from 'imagemin';
import ImageMinWebp from 'imagemin-webp';
import * as path from 'path';
import * as svgo from 'svgo';

// Map over all objects/arrays in the parsed SVG to find images
const uberMap = (obj, env) => {
  if (obj.name === 'image') return handleImage(obj, env);
  if (Array.isArray(obj)) return obj.map(o => uberMap(o, env));
  if (typeof obj !== 'object') return obj;
  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = uberMap(obj[key], env);
    return acc;
  }, {})
};

// I hate global state but here we go
let index = 0;
const images = [];
const handleImage = (image, { outputFolder, inputFileName, hrefPrefix }) => {
  if (!image.attributes || !image.attributes['xlink:href'] || !image.attributes['xlink:href'].startsWith('data:image'))
    return image;

  const href = image.attributes['xlink:href'];
  const base64 = href.slice(href.indexOf(',') + 1);
  const outputFileName = `${inputFileName}_${index++}`;
  const outputFilePath = path.join(outputFolder, `${outputFileName}.png`);

  images.push({ filePath: outputFilePath, width: image.attributes.width, height: image.attributes.height })
  fs.writeFileSync(outputFilePath, base64, { encoding: 'base64' })

  return { ...image, attributes: { ...image.attributes, 'xlink:href': `${hrefPrefix}${outputFileName}.webp` } };
};


// Arguments
const options = Yargs(hideBin(process.argv))
  .usage('svg-mannen')
  .version('1.0.0')
  .option('i', { alias: 'input', description: 'Input SVG file', type: 'string', demandOption: true })
  .option('k', { alias: 'keep', description: 'Keep extracted images', type: 'boolean', default: false })
  .option('q', { alias: 'quality', description: 'WebP quality (0 - 100)', default: 80, type: 'number' })
  .option('r', { alias: 'resize-coefficient', description: 'Resize coefficient', default: 1, type: 'number' })
  .option('p', { alias: 'href-prefix', description: 'Prefix for SVG hrefs to images, must end with /', default: '', type: 'string' })
  .argv;

const keepExtracted = options.k;
const quality = options.q;
const resize = options.r;
const hrefPrefix = options.p;

// Read file
const inputPath = options.i;
const file = fs.readFileSync(inputPath, { encoding: 'utf-8' });

// Create output folder
const inputFileName = path.basename(inputPath).replace(path.extname(inputPath), '');
const outputFolder = path.join(path.dirname(inputPath), inputFileName);
if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

console.log('Parsing SVG');
const parsed = SVG.parseSync(file);

console.log('Deconstructing SVG');
const newSVG = uberMap(parsed, { outputFolder, inputFileName, hrefPrefix });

if (!images.length) {
  console.log('No images found!')
  process.exit(1);
}

// Compress and resize all images
await Promise.all(images.map(async ({ filePath, width, height }, i) => {
  console.log(`Compressing image ${i + 1}/${images.length}`)
  await ImageMin([filePath], {
    destination: outputFolder,
    plugins: [
      ImageMinWebp(
        {
          quality,
          method: 6,
          resize: { width: width * resize, height: height * resize }
        })
    ]
  });
}));

console.log('Writing SVG');
fs.writeFileSync(path.join(outputFolder, `${inputFileName}.svg`), svgo.optimize(SVG.stringify(newSVG)).data);

// Delete extracted files
if (!keepExtracted)
  fs.readdirSync(outputFolder)
    .filter(f => f.startsWith('test') && f.endsWith('.png'))
    .forEach(f => fs.unlinkSync(`${outputFolder}${path.sep}${f}`));
