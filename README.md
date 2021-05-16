# svg-mannen
A Node.js command-line program that optimizes SVG files with embedded base64-encoded images by encoding (and optionally resizing) the images into the WebP format and run SVGO on the final SVG file.

## Modes
The program works in two modes:
- `extract`: Extracts all embedded images into separate (optionally resized) WebP files. This should be done to avoid the size increse of Base64 encoding which is roughly 137% but may cause issues with relative href paths.
- `embed`: Encodes and optionally resizes all embedded images and embeds them again.

## Usage
### Installation
```bash
git clone https://github.com/mightynerd/svg-mannen
cd svg-mannen

# For a global install
node i . -g
# Or to run it directly
node .
```

### Options
```
      --help                Show help                                                        [boolean]
      --version             Show version number                                              [boolean]
  -i, --input               Input SVG file                                         [string] [required]
  -m, --mode                Mode: 'embed' or 'extract'                   [string] [default: "extract"]
  -q, --quality             WebP quality (0 - 100)                              [number] [default: 80]
  -r, --resize-coefficient  Resize coefficient                                   [number] [default: 1]
  -p, --href-prefix         Prefix for SVG hrefs to images, must end with /     [string] [default: ""]
```

### Output
The output for `testfile.svg` will always be `testfile/testfile.svg`, with `testfile/testfile_0.webp` etc. for the `extract` mode.
