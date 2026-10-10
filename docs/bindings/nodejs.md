# Node.js & WebAssembly Integration Guide

This guide covers using **tree-sitter-groovy** in JavaScript/TypeScript environments, both natively on Node.js and in the browser using WebAssembly.

---

## 1. Native Node.js Binding

### Installation
```bash
npm install tree-sitter @loganprice/tree-sitter-groovy
```

### Basic Parsing (JavaScript / TypeScript)
```javascript
const Parser = require('tree-sitter');
const Groovy = require('@loganprice/tree-sitter-groovy');

const parser = new Parser();
parser.setLanguage(Groovy);

const sourceCode = `
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
}
`;

const tree = parser.parse(sourceCode);
console.log(tree.rootNode.toString());
```

### Querying in Node.js
```javascript
const query = Groovy.query(`
  (command_expression
    function: (identifier) @type
    arguments: (command_argument_list (literal (string_literal) @dep))
    (#any-of? @type "implementation" "testImplementation" "api"))
`);

const matches = query.matches(tree.rootNode);
for (const match of matches) {
  const typeNode = match.captures.find(c => c.name === 'type')?.node;
  const depNode = match.captures.find(c => c.name === 'dep')?.node;

  console.log(`${typeNode?.text} -> ${depNode?.text}`);
}
```

---

## 2. WebAssembly (Browser / Edge Runtimes)

The repository provides a pre-built WebAssembly binary: `tree-sitter-groovy.wasm`.

### Installation
```bash
npm install web-tree-sitter
```

### Browser / Vite / Webpack Usage
```javascript
import Parser from 'web-tree-sitter';

async function initParser() {
  await Parser.init();
  const parser = new Parser();

  // Load the pre-built WASM binary
  const Groovy = await Parser.Language.load('tree-sitter-groovy.wasm');
  parser.setLanguage(Groovy);

  const code = `
    pipeline {
        agent any
        stages {
            stage('Test') {
                steps {
                    sh 'npm test'
                }
            }
        }
    }
  `;

  const tree = parser.parse(code);
  console.log(tree.rootNode.toString());
  return tree;
}

initParser();
```

---

## 3. Rebuilding the WASM Binary

To rebuild `tree-sitter-groovy.wasm` from source (requires Docker or Emscripten):

```bash
npx tree-sitter build --wasm
```
This generates `tree-sitter-groovy.wasm` in the workspace root.
