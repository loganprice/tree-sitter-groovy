# tree-sitter-groovy Documentation

Welcome to the comprehensive documentation for **tree-sitter-groovy**, a robust Tree-sitter grammar and Concrete Syntax Tree (CST) parser for Groovy, designed with first-class support for Groovy 3/4, Gradle DSL, and Jenkinsfile pipelines.

---

## Documentation Index

### 1. Core Grammar & AST
- [**AST & Node Reference**](ast-reference.md): Detailed catalog of all AST node types, fields (`function:`, `arguments:`, `closure:`, `name:`), and Groovy-specific language constructs.
- [**Tree-sitter Query Guide**](queries.md): How to write Tree-sitter queries (`.scm`), pattern matching, predicates (`#eq?`, `#match?`, `#any-of?`), and editor integrations (Neovim, Helix, Zed).

### 2. Language Bindings Guides
- [**Go Integration Guide**](bindings/go.md): Using `github.com/tree-sitter/go-tree-sitter` (v0.25+) with `tree-sitter-groovy`. Parsing, queries, AST cursors, and error handling.
- [**Python Integration Guide**](bindings/python.md): Using the official `tree-sitter` Python wheels. Walking trees, inspecting nodes, executing queries.
- [**Rust Integration Guide**](bindings/rust.md): Using the `tree-sitter` Rust crate. Memory-safe zero-copy parsing and query cursors.
- [**Node.js & WebAssembly Guide**](bindings/nodejs.md): Using native Node.js bindings and browser-ready WebAssembly via `web-tree-sitter`.

### 3. Real-World DSL Recipes
- [**Jenkinsfile Analysis Recipe**](recipes/jenkinsfile.md): Querying Declarative & Scripted Jenkinsfiles, Kubernetes pod templates (`podTemplate`), multi-container pods (`container('...')`), stages, and steps.
- [**Gradle Build Script Recipe**](recipes/gradle.md): Extracting dependencies (`implementation`, `testImplementation`), plugins, repositories, and task registrations.
- [**Groovy AST Analysis Recipe**](recipes/groovy-ast-analysis.md): Inspecting class declarations, traits, closures, operator overloads, and dynamic typing patterns.

---

## Architecture & Design Principles

Groovy is a highly dynamic and syntactically flexible JVM language. This grammar was built to solve several unique challenges:

### 1. Optional Parentheses (Command Expressions)
Groovy allows omitting parentheses in method calls:
```groovy
// Parenthesis-less DSL command
sh 'mvn clean install'
id 'org.springframework.boot' version '3.2.0'
```
The grammar parses these as `command_expression` nodes, preserving the function identifier, arguments list, and chained function calls without ambiguity against standard expressions.

### 2. Closures as First-Class Citizens
Closures can be passed as method arguments or trailing closures outside parentheses:
```groovy
tasks.register('myTask') { ... } // Trailing closure
pipeline { ... }                  // Method call with closure body
```
The grammar represents trailing and standalone closures as `closure` nodes, exposing an optional `parameters` field and body statements.

### 3. Gradle and Jenkinsfile DSL Affinity
Beyond standard Groovy syntax (classes, methods, control flow), the grammar natively parses Jenkins declarative and scripted structures, Kubernetes pipeline DSLs, and Gradle build configurations without syntax errors.

---

## Language Support Matrix

| Language / Platform | Binding Package | Status | Minimum Version |
| :--- | :--- | :--- | :--- |
| **Go** | `github.com/loganprice/tree-sitter-groovy/bindings/go` | Supported | Go 1.22+ (`go-tree-sitter` v0.25+) |
| **Node.js** | `@loganprice/tree-sitter-groovy` | Supported | Node.js 18+ |
| **Python** | `tree-sitter-groovy` | Supported | Python 3.9+ (`tree-sitter` 0.22+) |
| **Rust** | `tree-sitter-groovy` | Supported | Rust 2021 edition (`tree-sitter` 0.24+) |
| **Browser / WASM** | `tree-sitter-groovy.wasm` | Supported | `web-tree-sitter` 0.24+ |
| **C / C++** | Native shared library (`src/parser.c`) | Supported | C11 / C++14 |

---

## Quickstart Across Languages

### Go
```go
package main

import (
	"fmt"
	tree_sitter_groovy "github.com/loganprice/tree-sitter-groovy/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func main() {
	parser := tree_sitter.NewParser()
	defer parser.Close()

	lang := tree_sitter.NewLanguage(tree_sitter_groovy.Language())
	parser.SetLanguage(lang)

	tree := parser.Parse([]byte("def greet(name) { println \"Hello $name\" }"), nil)
	defer tree.Close()

	fmt.Println(tree.RootNode().ToSexp())
}
```

### Python
```python
from tree_sitter import Language, Parser
import tree_sitter_groovy

lang = Language(tree_sitter_groovy.language())
parser = Parser(lang)

tree = parser.parse(b"def greet(name) { println 'Hello, ' + name }")
print(tree.root_node)
```

### Rust
```rust
use tree_sitter::Parser;

fn main() {
    let mut parser = Parser::new();
    let language = tree_sitter_groovy::LANGUAGE;
    parser.set_language(&language.into()).unwrap();

    let tree = parser.parse("def add(a, b) { a + b }", None).unwrap();
    println!("{}", tree.root_node().to_sexp());
}
```

### JavaScript / Node.js
```javascript
const Parser = require('tree-sitter');
const Groovy = require('@loganprice/tree-sitter-groovy');

const parser = new Parser();
parser.setLanguage(Groovy);

const tree = parser.parse("def list = [1, 2, 3]");
console.log(tree.rootNode.toString());
```
