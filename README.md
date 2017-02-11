html2jade-ls
================================================================

このリポジトリは [@donpark](https://github.com/donpark)氏の [donpark/html2jade](https://github.com/donpark/html2jade)のソースを LiveScript で書き直したものです。  
また、いくつかの未実装の部分も実装してあります。

## Install

    npm install https://github.com/noqisofon/html2pug-ls

## 既知のバグ

`html` 要素や `body` 要素の無い裸の要素が含まれた HTML ファイルを変換する際に、一番始めの要素(コメント等)が `html` 要素の外に出てしまう。
