html2pug-ls
================================================================

This repository is a rewrite of the source of [@donpark](https://github.com/donpark)'s [donpark/html2jade](https://github.com/donpark/html2jade) with LiveScript.
Also, some unimplemented parts are also implemented.

## Install

    npm install https://github.com/noqisofon/html2pug-ls

## Implemented

- Conversion from URL.

## Known bugs

- When converting an HTML file that contains bare elements without `html` elements and `body` elements, the first element (comment etc.) comes out of the `html` element.
