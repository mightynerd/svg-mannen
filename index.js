#!/usr/bin/env node¨

import Yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
import * as fs from 'fs';
import * as SVG from 'svgson';
import ImageMin from 'imagemin';
import ImageMinWebp from 'imagemin-webp';
import * as path from 'path';
import * as svgo from 'svgo';
import Bluebird from 'bluebird';

// Map over all objects/arrays in the parsed SVG to find images
const uberMap = async (obj, env) => {
  if (obj.name === 'image') return await handleImage(obj, env);
  if (Array.isArray(obj)) return await Promise.all(obj.map(async (o) => await uberMap(o, env)));
  if (typeof obj !== 'object') return obj;
  return await Bluebird.reduce(Object.keys(obj), async (acc, key) => {
    acc[key] = await uberMap(obj[key], env);
    return acc;
  }, {})
};

// I hate global state but here we go
let index = 0;
const handleImage = async (image, { outputFolder, inputFileName, hrefPrefix, mode, resize }) => {
  if (!image.attributes || !image.attributes['xlink:href'] || !image.attributes['xlink:href'].startsWith('data:image'))
    return image;

  const href = image.attributes['xlink:href'];
  const base64 = href.slice(href.indexOf(',') + 1);
  const buffer = Buffer.from(base64, 'base64');

  const outputFileName = `${inputFileName}_${index++}`;
  const outputFilePath = path.join(outputFolder, `${outputFileName}.webp`);

  const [width, height] = [image.attributes.width, image.attributes.height];

  // Compress the image from the buffer
  console.log(`Compressing image ${index + 1}`);
  const compressed = await ImageMin.buffer(buffer, {
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

  // Either write the file to `outputFilePath` or embed it with base64
  if (mode === 'extract') {
    fs.writeFileSync(outputFilePath, compressed)
    return { ...image, attributes: { ...image.attributes, 'xlink:href': `${hrefPrefix}${outputFileName}.webp` } };
  } else {
    return { ...image, attributes: { ...image.attributes, 'xlink:href': 'data:image/webp;base64,' + compressed.toString('base64') } }
  }
};


// Arguments
const options = Yargs(hideBin(process.argv))
  .usage('svg-mannen')
  .version('1.0.0')
  .option('i', { alias: 'input', description: 'Input SVG file', type: 'string', demandOption: true })
  .option('m', { alias: 'mode', description: "Mode: 'embed' or 'extract'", type: 'string', default: 'extract' })
  .option('q', { alias: 'quality', description: 'WebP quality (0 - 100)', default: 80, type: 'number' })
  .option('r', { alias: 'resize-coefficient', description: 'Resize coefficient', default: 1, type: 'number' })
  .option('p', { alias: 'href-prefix', description: 'Prefix for SVG hrefs to images, must end with /', default: '', type: 'string' })
  .argv;

const quality = options.q;
const resize = options.r;
const hrefPrefix = options.p;
const mode = options.m === 'embed' || options.m === 'extract' ? options.m : 'extract';

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
const newSVG = await uberMap(parsed, { outputFolder, inputFileName, hrefPrefix, mode, resize });

console.log('Writing SVG');
fs.writeFileSync(path.join(outputFolder, `${inputFileName}.svg`), svgo.optimize(SVG.stringify(newSVG)).data);
