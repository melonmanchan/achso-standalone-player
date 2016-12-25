#!/usr/bin/env sh
set -e
mkdir -p dist

useref index.html dist/index.html
html-minifier --collapse-whitespace --remove-attribute-quotes --sort-attributes --minify-js --html5 dist/index.html > dist/temp.html
mv dist/temp.html dist/index.html

cleancss -o dist/player.css player.css

uglifyjs lib/base64.min.js player/*.js --compress --mangle -o dist/dist.js

surge dist https://achso-embed.surge.sh
