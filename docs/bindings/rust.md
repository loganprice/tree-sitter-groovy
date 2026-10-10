# Rust Integration Guide

This guide explains how to use **tree-sitter-groovy** in Rust with the official `tree-sitter` crate.

---

## 1. Installation

Add `tree-sitter` and `tree-sitter-groovy` to your `Cargo.toml`:

```toml
[dependencies]
tree-sitter = "0.24"
tree-sitter-groovy = { git = "https://github.com/loganprice/tree-sitter-groovy" }
```

---

## 2. Basic Parsing

```rust
use tree_sitter::Parser;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut parser = Parser::new();
    let language = tree_sitter_groovy::LANGUAGE;
    parser.set_language(&language.into())?;

    let source = r#"
class Calculator {
    int add(int a, int b) {
        return a + b
    }
}
"#;

    let tree = parser.parse(source, None).ok_or("Failed to parse")?;
    let root = tree.root_node();

    println!("AST S-expression:\n{}", root.to_sexp());
    Ok(())
}
```

---

## 3. Node Traversal & Text Slicing

Rust provides safe, zero-copy slicing directly against the source string using byte ranges:

```rust
use tree_sitter::Node;

fn print_methods<'a>(node: Node<'a>, source: &'a str) {
    if node.kind() == "method_declaration" {
        if let Some(name_node) = node.child_by_field_name("name") {
            let method_name = &source[name_node.byte_range()];
            let start = node.start_position();
            println!("Found method '{}' at line {}", method_name, start.row + 1);
        }
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        print_methods(child, source);
    }
}
```

---

## 4. Querying with `QueryCursor`

```rust
use tree_sitter::{Parser, Query, QueryCursor};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut parser = Parser::new();
    let language = tree_sitter_groovy::LANGUAGE.into();
    parser.set_language(&language)?;

    let source = r#"
stage('Build') {
    sh 'mvn clean package'
    junit 'target/surefire-reports/*.xml'
}
"#;

    let tree = parser.parse(source, None).unwrap();

    let query_str = r#"
(command_expression
  function: (identifier) @cmd_name
  arguments: (command_argument_list) @cmd_args)
"#;

    let query = Query::new(&language, query_str)?;
    let mut cursor = QueryCursor::new();
    let matches = cursor.matches(&query, tree.root_node(), source.as_bytes());

    for m in matches {
        for capture in m.captures {
            let capture_name = &query.capture_names()[capture.index as usize];
            let text = &source[capture.node.byte_range()];
            println!("Capture @{}: {}", capture_name, text);
        }
    }

    Ok(())
}
```
