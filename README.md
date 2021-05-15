# svg-mannen
A Node.js command-line program that optimizes SVG files with embedded base64-encoded images.

It:
1. Extracts all embedded base64 encoded images and converts them to the WebP format.
2. Replaces the base64 encodings in the SVG file with a href to the extracted files.
