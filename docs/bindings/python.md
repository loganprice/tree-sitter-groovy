# Python Integration Guide

This guide explains how to use **tree-sitter-groovy** in Python using the official `tree-sitter` package.

---

## 1. Installation

Install the pre-built wheels from PyPI:

```bash
pip install tree-sitter tree-sitter-groovy
```

---

## 2. Basic Usage

```python
from tree_sitter import Language, Parser
import tree_sitter_groovy

# 1. Initialize the Groovy Language and Parser
GROOVY_LANGUAGE = Language(tree_sitter_groovy.language())
parser = Parser(GROOVY_LANGUAGE)

# 2. Source code must be passed as bytes
source_code = b"""
def greet(String name) {
    println "Hello, ${name}!"
}
"""

# 3. Parse into Concrete Syntax Tree
tree = parser.parse(source_code)
root = tree.root_node

# 4. Inspect AST
print(root.to_sexp())
print(f"Root kind: {root.type}")
print(f"Child count: {root.child_count}")
```

---

## 3. AST Inspection and Navigation

```python
# Access children by field name
for child in root.children:
    if child.type == "method_declaration":
        name_node = child.child_by_field_name("name")
        params_node = child.child_by_field_name("parameters")
        body_node = child.child_by_field_name("body")

        method_name = name_node.text.decode("utf-8")
        start_row, start_col = child.start_point
        end_row, end_col = child.end_point

        print(f"Method '{method_name}' defined at Line {start_row + 1}:{start_col + 1}")
```

---

## 4. Querying the AST

Using Tree-sitter's pattern matching to extract Jenkinsfile steps:

```python
from tree_sitter import Language, Parser
import tree_sitter_groovy

GROOVY_LANGUAGE = Language(tree_sitter_groovy.language())
parser = Parser(GROOVY_LANGUAGE)

jenkinsfile = b"""
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'mvn -B clean verify'
                echo 'Build completed'
            }
        }
    }
}
"""

tree = parser.parse(jenkinsfile)

# Compile query
query = GROOVY_LANGUAGE.query("""
(command_expression
  function: (identifier) @step_name
  arguments: (command_argument_list) @step_args)
""")

# Execute captures
captures = query.captures(tree.root_node)

for node, capture_name in captures:
    text = node.text.decode("utf-8")
    print(f"Captured {capture_name}: {text} at {node.start_point}")
```

---

## 5. Walking the Tree Recursively

```python
def walk_tree(node, depth=0):
    indent = "  " * depth
    field = f"[{node.grammar_name}] " if hasattr(node, 'grammar_name') else ""
    print(f"{indent}{field}{node.type} ({node.start_point} - {node.end_point})")
    
    for child in node.named_children:
        walk_tree(child, depth + 1)

tree = parser.parse(b"plugins { id 'java' }")
walk_tree(tree.root_node)
```
