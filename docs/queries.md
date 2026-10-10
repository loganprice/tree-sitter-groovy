# Tree-sitter Queries Guide for Groovy

Tree-sitter provides a powerful Lisp-like S-expression pattern-matching query language. This guide explains how to query Groovy code with `tree-sitter-groovy` for syntax highlighting, code intelligence, linters, and analysis tools.

---

## 1. Query Syntax Fundamentals

A query consists of one or more S-expression patterns that match subtrees in the AST:

```scm
; Match any method call named 'cleanWs'
(method_call
  function: (identifier) @step.name
  (#eq? @step.name "cleanWs"))
```

### Key Query Elements
- **Node Type**: E.g. `(method_call ...)` matches a node of that kind.
- **Fields**: E.g. `function: (identifier)` matches a child assigned to that field name.
- **Anonymous Tokens**: E.g. `("package")` or `("def")` matches specific literals.
- **Captures**: `@name` tags the matched node with an identifier accessible in your host language.
- **Wildcard**: `(_)` matches any named node; `_` matches any node (named or anonymous).
- **Grouping & Choices**: `[ (method_call) (command_expression) ]` matches any of the listed patterns.
- **Optional & Repetition**: `(named_argument)?`, `(statement)*`, `(formal_parameter)+`.

---

## 2. Using Predicates

Tree-sitter queries support text predicates to filter matches:

### Equality Predicates (`#eq?` and `#not-eq?`)
```scm
; Match only commands where the function name is 'sh'
(command_expression
  function: (identifier) @cmd
  (#eq? @cmd "sh"))
```

### Regular Expression Predicates (`#match?` and `#not-match?`)
```scm
; Match functions starting with 'test'
(method_declaration
  name: (identifier) @test_method
  (#match? @test_method "^test[A-Z]"))
```

### Multiple Value Matching (`#any-of?`)
```scm
; Match specific Jenkins shell steps
(command_expression
  function: (identifier) @step
  (#any-of? @step "sh" "bat" "powershell" "pwsh"))
```

---

## 3. Built-in Editor Queries

The repository includes three standard queries in the [`queries/`](../queries) directory:

### Syntax Highlighting (`queries/highlights.scm`)
Categorizes code tokens for syntax highlighters:
- `@keyword`, `@keyword.control`, `@keyword.modifier`
- `@function.method`, `@function.call`
- `@type`, `@type.builtin`, `@type.definition`
- `@string`, `@string.regex`, `@number`, `@boolean`
- `@comment.line`, `@comment.block`
- `@operator`, `@punctuation.bracket`, `@punctuation.delimiter`

### Code Navigation / Symbols (`queries/tags.scm`)
Identifies symbol definitions for ctags and language servers:
- Class definitions: `(class_declaration name: (identifier) @name) @definition.class`
- Method definitions: `(method_declaration name: (identifier) @name) @definition.method`
- Interface definitions: `(interface_declaration name: (identifier) @name) @definition.interface`

### Code Folding (`queries/folds.scm`)
Defines collapsible regions:
- Block bodies: `(block) @fold`
- Class bodies: `(class_declaration body: (_) @fold)`
- Closures: `(closure) @fold`

---

## 4. Practical Custom Queries

### Example 1: Finding Gradle Dependencies
To extract all dependency declarations in a `build.gradle` file:
```scm
(command_expression
  function: (identifier) @configuration
  arguments: (command_argument_list
    (literal
      (string_literal) @dependency_coordinate))
  (#any-of? @configuration "implementation" "testImplementation" "api" "runtimeOnly"))
```

### Example 2: Finding Jenkins Pipeline Stages and Step Calls
```scm
; Capture stage names
(method_call
  function: (identifier) @_fn (#eq? @_fn "stage")
  arguments: (argument_list
    (literal
      (string_literal) @stage.name))
  closure: (closure) @stage.body)

; Capture command steps (e.g. sh 'mvn clean')
(command_expression
  function: (identifier) @step.name
  arguments: (command_argument_list)? @step.args)
```

### Example 3: Finding Deprecated Operators or Patterns
```scm
; Match direct field access bypassing encapsulation (user.@privateField)
(direct_field_access
  object: (identifier) @target_obj
  field: (identifier) @private_field) @violation
```

---

## 5. Editor Integrations

### Neovim (`nvim-treesitter`)
1. Add `tree-sitter-groovy` to your parser configurations:
   ```lua
   local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
   parser_config.groovy = {
     install_info = {
       url = "https://github.com/loganprice/tree-sitter-groovy",
       files = {"src/parser.c"},
       branch = "main",
     },
     filetype = "groovy",
   }
   ```
2. Copy `queries/highlights.scm` to `~/.config/nvim/after/queries/groovy/highlights.scm`.

### Helix
Add to your `languages.toml`:
```toml
[[language]]
name = "groovy"
scope = "source.groovy"
injection-regex = "groovy"
file-types = ["groovy", "gvy", "gy", "gsh", "Jenkinsfile", "gradle"]
comment-token = "//"
indent = { tab-width = 4, unit = "    " }

[[grammar]]
name = "groovy"
source = { git = "https://github.com/loganprice/tree-sitter-groovy", rev = "main" }
```

### Zed
Add `tree-sitter-groovy` in your extension `extension.toml` pointing to the repository grammar.
