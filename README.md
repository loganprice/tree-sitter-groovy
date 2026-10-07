# tree-sitter-groovy

[![CI](https://github.com/tree-sitter/tree-sitter-groovy/actions/workflows/ci.yml/badge.svg)](https://github.com/tree-sitter/tree-sitter-groovy/actions)

Tree-sitter grammar and concrete syntax tree parser for **Groovy**, designed with first-class support for **Gradle** build scripts (`build.gradle`, `settings.gradle`) and **Jenkinsfiles** (both Declarative and Scripted pipelines).

Includes native and WebAssembly bindings for **Node.js**, **Rust**, **Go**, **Python**, and **WebAssembly (WASM)**.

---

## Features

- **Full Groovy Language Core**:
  - Declarations: Classes, interfaces, traits, enums, records, constructors, and methods with default arguments.
  - Closures: Parameter lists with default values, implicit `it`, `->` token, and multi-statement closure bodies.
  - Groovy Operators:
    - Safe navigation (`?.`), spread-dot (`*.`), direct field access (`.@`), method pointer (`.&`), method reference (`::`).
    - Elvis operator (`?:`), ternary operator (`? :`), spaceship operator (`<=>`), regex matchers (`=~`, `==~`).
    - Inclusive and half-open ranges (`..`, `..<`, `<..`, `<..<`).
  - Strings & Interpolation:
    - Single-quoted (`'...'`), triple-single-quoted (`'''...'''`).
    - Double-quoted interpolated (`"..."`), triple-double-quoted (`"""..."""`).
    - Dollar-slashy strings (`$/.../$`).
  - Control Flow: `if/else`, classic `for`, Groovy `for (item in collection)`, `while`, `do-while`, `switch/case/default`, `try/catch/finally` with multi-catch.

- **First-Class Gradle DSL Support**:
  - `plugins { id '...' version '...' }`
  - `repositories { mavenCentral(); google() }`
  - `dependencies { implementation '...'; testImplementation '...' }`
  - Task registrations: `tasks.register('myTask', Copy) { from 'src'; into 'build' }`
  - Property assignments: `group = 'com.example'`, `rootProject.name = 'my-app'`

- **First-Class Jenkinsfile Pipeline Support**:
  - Declarative Pipelines: `pipeline { agent any; stages { stage('Build') { steps { sh 'make' } } } }`
  - Scripted Pipelines: `node('linux') { stage('Build') { sh 'make' } }`
  - Shared Libraries: `@Library('my-shared-lib') _`
  - Error handling: `try { ... } catch (Exception err) { currentBuild.result = 'FAILURE' }`

- **Editor Queries**:
  - Syntax highlighting (`queries/highlights.scm`)
  - Code navigation symbols & tags (`queries/tags.scm`)
  - Code folding (`queries/folds.scm`)

---

## Language Bindings

### Node.js (JavaScript & TypeScript)

Install:
```bash
npm install @loganprice/tree-sitter-groovy tree-sitter
```

Usage:
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

---

### Rust

Add to your `Cargo.toml`:
```toml
[dependencies]
tree-sitter = "0.24"
tree-sitter-groovy = { git = "https://github.com/tree-sitter/tree-sitter-groovy" }
```

Usage:
```rust
use tree_sitter::Parser;

fn main() {
    let mut parser = Parser::new();
    let language = tree_sitter_groovy::LANGUAGE;
    parser
        .set_language(&language.into())
        .expect("Error loading Groovy parser");

    let source = r#"
    pipeline {
        agent any
        stages {
            stage('Test') {
                steps {
                    sh 'cargo test'
                }
            }
        }
    }
    "#;

    let tree = parser.parse(source, None).unwrap();
    let root = tree.root_node();
    println!("{}", root.to_sexp());
}
```

---

### Go

Install:
```bash
go get github.com/tree-sitter/go-tree-sitter
go get github.com/tree-sitter/tree-sitter-groovy
```

Usage:
```go
package main

import (
	"fmt"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_groovy "github.com/tree-sitter/tree-sitter-groovy/bindings/go"
)

func main() {
	parser := tree_sitter.NewParser()
	defer parser.Close()

	language := tree_sitter.NewLanguage(tree_sitter_groovy.Language())
	parser.SetLanguage(language)

	code := []byte(`rootProject.name = 'my-app'`)
	tree := parser.Parse(code, nil)
	defer tree.Close()

	fmt.Println(tree.RootNode().ToSexp())
}
```

---

### Python

Install:
```bash
pip install tree-sitter tree-sitter-groovy
```

Usage:
```python
from tree_sitter import Language, Parser
import tree_sitter_groovy

GROOVY_LANGUAGE = Language(tree_sitter_groovy.language())
parser = Parser(GROOVY_LANGUAGE)

code = b"""
tasks.register('buildApp', Copy) {
    from 'src'
    into 'build/output'
}
"""

tree = parser.parse(code)
print(tree.root_node.to_sexp())
```

---

### WebAssembly (WASM) / Browser

The pre-built WebAssembly binary `tree-sitter-groovy.wasm` is included in the package.

Usage with `web-tree-sitter`:
```javascript
import Parser from 'web-tree-sitter';

await Parser.init();
const parser = new Parser();
const Groovy = await Parser.Language.load('tree-sitter-groovy.wasm');
parser.setLanguage(Groovy);

const tree = parser.parse(`
class Calculator {
    def add(int a, int b) {
        return a + b
    }
}
`);
console.log(tree.rootNode.toString());
```

---

## Development & Testing

Run generator and corpus tests:
```bash
npx tree-sitter generate
npx tree-sitter test
```

Build the WebAssembly binary:
```bash
npx tree-sitter build --wasm
```

Run test suite across languages:
```bash
# Node
node --test bindings/node/*_test.js

# Go
go test ./bindings/go/...

# Rust
cargo test
```

## License

MIT License. See [LICENSE](LICENSE) for details.
