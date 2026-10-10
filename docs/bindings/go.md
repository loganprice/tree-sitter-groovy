# Go Integration Guide

This guide explains how to use **tree-sitter-groovy** in Go using the official modern tree-sitter driver (`github.com/tree-sitter/go-tree-sitter` v0.25+).

---

## 1. Installation

In your Go project:

```bash
# Install the modern Tree-sitter Go driver
go get github.com/tree-sitter/go-tree-sitter

# Install the Groovy grammar binding
go get github.com/loganprice/tree-sitter-groovy
```

Requires Go 1.22+ and a C compiler (CGO enabled) to build the C parser runtime.

---

## 2. Basic Parsing

```go
package main

import (
	"fmt"
	"log"

	tree_sitter_groovy "github.com/loganprice/tree-sitter-groovy/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func main() {
	// 1. Load language definition
	lang := tree_sitter.NewLanguage(tree_sitter_groovy.Language())
	if lang == nil {
		log.Fatal("Failed to load Groovy language")
	}

	// 2. Initialize parser
	parser := tree_sitter.NewParser()
	defer parser.Close()

	if err := parser.SetLanguage(lang); err != nil {
		log.Fatalf("Failed to set language: %v", err)
	}

	// 3. Parse source code
	sourceCode := []byte(`
def multiply(int a, int b) {
    return a * b
}
`)

	tree := parser.Parse(sourceCode, nil)
	if tree == nil {
		log.Fatal("Failed to parse code")
	}
	defer tree.Close()

	// 4. Print S-expression representation
	root := tree.RootNode()
	fmt.Println(root.ToSexp())
}
```

---

## 3. Working with AST Nodes

Every node in the tree exposes location, kind, and text inspection methods:

```go
// Node Kind (string representing grammar rule)
kind := node.Kind() // e.g. "method_declaration", "identifier"

// UTF-8 Text from original source bytes
text := node.Utf8Text(sourceCode)

// Position in source file (0-indexed Row and Column)
start := node.StartPosition() // start.Row, start.Column
end := node.EndPosition()

// Byte offsets
startByte := node.StartByte()
endByte := node.EndByte()

// Parent and Siblings
parent := node.Parent()
nextSibling := node.NextNamedSibling()
prevSibling := node.PrevNamedSibling()

// Fields
functionNode := node.ChildByFieldName("function")
argumentsNode := node.ChildByFieldName("arguments")
closureNode := node.ChildByFieldName("closure")
```

---

## 4. Querying the AST with Tree-sitter Queries

Tree-sitter queries allow extracting patterns declaratively using S-expressions:

```go
package main

import (
	"fmt"
	"log"

	tree_sitter_groovy "github.com/loganprice/tree-sitter-groovy/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func main() {
	lang := tree_sitter.NewLanguage(tree_sitter_groovy.Language())
	parser := tree_sitter.NewParser()
	defer parser.Close()
	parser.SetLanguage(lang)

	code := []byte(`
stage('Build') {
    sh 'mvn -B clean verify'
    cleanWs()
}
`)

	tree := parser.Parse(code, nil)
	defer tree.Close()

	// 1. Compile Query
	queryStr := `
(method_call
  function: (identifier) @stage_fn (#eq? @stage_fn "stage")
  arguments: (argument_list (literal (string_literal) @stage_name))
  closure: (closure
    (expression_statement
      [
        (command_expression function: (identifier) @step_name arguments: (command_argument_list)? @step_args)
        (method_call function: (identifier) @step_name arguments: (argument_list)? @step_args)
      ])))
`
	query, qErr := tree_sitter.NewQuery(lang, queryStr)
	if qErr != nil {
		log.Fatalf("Query compilation failed: %v", qErr)
	}
	defer query.Close()

	// 2. Create Query Cursor
	qc := tree_sitter.NewQueryCursor()
	defer qc.Close()

	// 3. Iterate Matches
	matches := qc.Matches(query, tree.RootNode(), code)
	captureNames := query.CaptureNames()

	for {
		match := matches.Next()
		if match == nil {
			break
		}

		var stageName, stepName, stepArgs string
		for _, capture := range match.Captures {
			name := captureNames[capture.Index]
			val := capture.Node.Utf8Text(code)
			switch name {
			case "stage_name":
				stageName = val
			case "step_name":
				stepName = val
			case "step_args":
				stepArgs = val
			}
		}

		fmt.Printf("Stage: %s | Step: %s | Args: %s\n", stageName, stepName, stepArgs)
	}
}
```

---

## 5. TreeCursor: Fast AST Traversal

If you need to iterate millions of nodes with zero heap allocations, use `TreeCursor`:

```go
cursor := root.Walk()
defer cursor.Close()

for {
    node := cursor.Node()
    if node.Kind() == "method_declaration" {
        fmt.Println("Found method:", node.ChildByFieldName("name").Utf8Text(sourceCode))
    }

    if cursor.GotoFirstChild() {
        continue
    }
    if cursor.GotoNextSibling() {
        continue
    }
    for cursor.GotoParent() {
        if cursor.GotoNextSibling() {
            break
        }
    }
}
```

---

## 6. Error Detection and Resilience

Tree-sitter provides fault-tolerant parsing. If the Groovy source code has syntax errors, parsing still succeeds, producing `ERROR` or `MISSING` nodes:

```go
func checkForSyntaxErrors(node *tree_sitter.Node) bool {
    if node.IsError() {
        fmt.Printf("Syntax error at line %d:%d\n", 
            node.StartPosition().Row+1, 
            node.StartPosition().Column+1)
        return true
    }
    if node.IsMissing() {
        fmt.Printf("Missing expected token at line %d:%d\n", 
            node.StartPosition().Row+1, 
            node.StartPosition().Column+1)
        return true
    }

    hasErr := false
    for i := uint(0); i < node.NamedChildCount(); i++ {
        child := node.NamedChild(i)
        if child != nil && checkForSyntaxErrors(child) {
            hasErr = true
        }
    }
    return hasErr
}
```

---

## 7. Complete Runnable CLI Example

For a complete CLI application parsing Jenkinsfiles, extracting steps, and tracking Kubernetes pod container scopes, review the runnable example in [`examples/jenkins_steps/main.go`](../../examples/jenkins_steps/main.go).
