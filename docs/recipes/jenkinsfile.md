# Recipe: Jenkinsfile Parsing & Pipeline Analysis

This recipe provides a complete guide for parsing, validating, and extracting information from **Jenkinsfiles** across both **Declarative** and **Scripted** pipelines, including jobs running inside **Kubernetes pods**.

---

## 1. Pipeline Types & Syntax Differences

| Feature | Declarative Pipeline | Scripted Pipeline |
| :--- | :--- | :--- |
| **Root Wrapper** | `pipeline { ... }` | `node(...) { ... }` or `podTemplate(...) { node(...) { ... } }` |
| **Agent Syntax** | `agent any`, `agent { kubernetes { ... } }` | `node('label')`, `podTemplate(...)` |
| **Stages** | Strictly enclosed in `stages { stage(...) { ... } }` | `stage(...) { ... }` anywhere |
| **Steps** | Must be enclosed in `steps { ... }` | Direct statements inside stages or nodes |
| **Post Actions**| Structured `post { always { ... }, failure { ... } }` | `try { ... } catch (err) { ... } finally { ... }` |

---

## 2. Tree-sitter AST Representation

### Declarative Pipeline
```
(expression_statement
  (closure_call_expression
    function: (identifier)                  ; "pipeline"
    closure: (closure
      (expression_statement
        (closure_call_expression
          function: (identifier)            ; "stages"
          closure: (closure
            (expression_statement
              (method_call
                function: (identifier)      ; "stage"
                arguments: (argument_list
                  (literal (string_literal))) ; 'Build'
                closure: (closure
                  (expression_statement
                    (closure_call_expression
                      function: (identifier); "steps"
                      closure: (closure ...))))))))))))
```

### Scripted Pipeline with Kubernetes Pod Template
```
(expression_statement
  (method_call
    function: (identifier)                  ; "podTemplate"
    arguments: (argument_list ...)
    closure: (closure
      (expression_statement
        (method_call
          function: (identifier)            ; "node"
          arguments: (argument_list ...)
          closure: (closure
            (expression_statement
              (method_call
                function: (identifier)      ; "stage"
                arguments: (argument_list ...)))))))))
```

---

## 3. Query Patterns for Jenkinsfiles

### Capturing All Stages
Works uniformly for both Declarative and Scripted pipelines:
```scm
(method_call
  function: (identifier) @_fn (#eq? @_fn "stage")
  arguments: (argument_list
    (literal
      (string_literal) @stage_name))
  closure: (closure) @stage_body)
```

### Capturing Steps (Leaf Steps and Block Wrappers)
Inside a `steps { ... }` block, `node { ... }` block, or post condition:
```scm
[
  ; Parenthesis-less steps (e.g. sh 'make', echo 'hi', git url: '...')
  (command_expression
    function: (identifier) @step_name
    arguments: (command_argument_list)? @step_args
    closure: (closure)? @step_closure)

  ; Method-call steps (e.g. cleanWs(), junit('...'), container('golang') { ... })
  (method_call
    function: (identifier) @step_name
    arguments: (argument_list)? @step_args
    closure: (closure)? @step_closure)

  ; Standalone closure steps (e.g. script { ... }, always { ... })
  (closure_call_expression
    function: (identifier) @step_name
    closure: (closure) @step_closure)
] @step
```

---

## 4. Resolving Kubernetes Pod & Container Context

When pipelines run on Kubernetes agents, steps frequently execute inside specific containers via `container('...') { ... }`.

### Algorithm for Context Resolution:
Rather than writing an overly complex query for every nesting level, query candidate step nodes and walk up the AST using `node.Parent()`:

```go
func resolveContext(stepNode *tree_sitter.Node, src []byte) (stage string, container string) {
    for curr := stepNode.Parent(); curr != nil; curr = curr.Parent() {
        // Enclosing container('...')
        if curr.Kind() == "method_call" && container == "" {
            fn := curr.ChildByFieldName("function")
            if fn != nil && fn.Utf8Text(src) == "container" {
                args := curr.ChildByFieldName("arguments")
                container = extractFirstArgString(args, src)
            }
        }

        // Enclosing stage('...')
        if curr.Kind() == "method_call" && stage == "" {
            fn := curr.ChildByFieldName("function")
            if fn != nil && fn.Utf8Text(src) == "stage" {
                args := curr.ChildByFieldName("arguments")
                stage = extractFirstArgString(args, src)
            }
        }
    }
    return stage, container
}
```

---

## 5. Working Example Program

The repository provides a complete Go CLI tool implementing this analysis:

```bash
# Run against the bundled sample pipelines:
go run examples/jenkins_steps/main.go

# Format as JSON:
go run examples/jenkins_steps/main.go -json
```

See [`examples/jenkins_steps/main.go`](../../examples/jenkins_steps/main.go) for source code.
