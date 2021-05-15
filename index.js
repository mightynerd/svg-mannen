#!/usr/bin/env node
import Yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
import * as fs from 'fs';
import * as SVG from 'svgson';
import ImageMin from 'imagemin';
import ImageMinWebp from 'imagemin-webp';
import * as path from 'path';

const uberMap = (obj, env) => {
  if (obj.name === 'image') return handleImage(obj, env);
  if (Array.isArray(obj)) return obj.map(o => uberMap(o, env));
  if (typeof obj !== 'object') return obj;
  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = uberMap(obj[key], env);
    return acc;
  }, {})
};

let index = 0;
const handleImage = (image, { outputFolder, inputFileName }) => {
  if (!image.attributes || !image.attributes['xlink:href'] || !image.attributes['xlink:href'].startsWith('data:image'))
    return image;

  const href = image.attributes['xlink:href'];
  const base64 = href.slice(href.indexOf(',') + 1);
  const outputFileName = `${inputFileName}_${index++}`;
  fs.writeFileSync(path.join(outputFolder, `${outputFileName}.png`), base64, { encoding: 'base64' })
  return { ...image, attributes: { ...image.attributes, 'xlink:href': `${outputFileName}.webp` } };
};


// Arguments
const options = Yargs(hideBin(process.argv))
  .usage('svg-mannen')
  .option('i', { alias: 'input', description: 'Input SVG file', type: 'string', demandOption: true })
  .option('k', { alias: 'keep', description: 'Keep extracted images', type: 'boolean', default: false })
  .option('q', { alias: 'quality', description: 'WebP quality (0 - 100)', default: 80, type: 'number' })
  .argv;

const keepExtracted = options.k;
const quality = options.q;

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
const newSVG = uberMap(parsed, { outputFolder, inputFileName });

console.log('Compressing images');
await ImageMin([`${outputFolder}${path.sep}*.{jpg,png}`], { destination: outputFolder, plugins: [ImageMinWebp({ quality })] });

console.log('Writing SVG');
fs.writeFileSync(path.join(outputFolder, `${inputFileName}.svg`), SVG.stringify(newSVG));

// Delete extracted files
if (!keepExtracted)
  fs.readdirSync(outputFolder)
    .filter(f => f.startsWith('test') && f.endsWith('.png'))
    .forEach(f => fs.unlinkSync(`${outputFolder}${path.sep}${f}`));
