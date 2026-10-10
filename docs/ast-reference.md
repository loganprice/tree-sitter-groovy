# Groovy AST & Node Reference

This document provides a comprehensive reference of the Concrete Syntax Tree (CST) and Abstract Syntax Tree (AST) produced by **tree-sitter-groovy**.

---

## 1. Top-Level Structure

### `source_file`
The root node of any Groovy document or script.
- **Children**: Statements, declarations, or comments.
- **Example**:
  ```groovy
  package com.example
  import java.util.List
  class App {}
  ```

### `shebang`
Captures executable interpreter directives at the start of a script.
- **Example**: `#!/usr/bin/env groovy`

### `line_comment` and `block_comment`
Comments are declared as grammar extras, preserving them in the tree for tools like formatters and linters.
- **Examples**: `// Line comment` or `/* Block comment */`

---

## 2. Declarations

### `package_declaration`
Declares the package namespace.
- **Fields**:
  - `name`: `qualified_identifier`
- **Example**: `package org.example.service`

### `import_declaration`
Import statements, including static and aliased imports.
- **Fields**:
  - `name`: `import_name`
  - `alias`: `identifier` (optional)
- **Anonymous Tokens**: `'static'`, `'as'`, `'*'` (aliased to `wildcard_import`)
- **Examples**:
  ```groovy
  import java.util.Map
  import static java.lang.Math.PI as MY_PI
  import groovy.transform.*
  ```

### `class_declaration`, `interface_declaration`, `trait_declaration`, `enum_declaration`, `record_declaration`
Object-oriented and type declarations.
- **Fields**:
  - `name`: `identifier` (alias `type_definition`)
  - `type_parameters`: generic type parameters (optional)
  - `superclass`: inherited class via `extends` (optional)
  - `interfaces`: implemented interfaces via `implements` (optional)
  - `body`: class block containing fields and methods
- **Example**:
  ```groovy
  class Service<T> extends BaseService implements Executable {
      // body
  }
  ```

### `method_declaration`
Methods with return types or dynamic `def` declarations.
- **Fields**:
  - `name`: `identifier`
  - `type`: return type (optional)
  - `parameters`: `formal_parameters`
  - `body`: `block`
- **Example**:
  ```groovy
  def calculate(int count, String prefix = 'item') {
      return "$prefix: $count"
  }
  ```

### `constructor_declaration`
Constructors matching the enclosing class name.
- **Fields**:
  - `name`: `identifier`
  - `parameters`: `formal_parameters`
  - `body`: `block`

### `variable_declaration`
Local variable or field definitions.
- **Children**: `variable_declarator` or `initialized_variable_declarator`
- **Fields**:
  - `name`: `identifier`
  - `value`: initializer expression (optional)
- **Example**: `def port = 8080`, `String host = 'localhost'`

---

## 3. DSL Constructs, Method Calls & Closures

Groovy's flexibility relies on methods without parentheses and closures. The grammar cleanly categorizes them into three primary node types:

### `method_call`
A standard method call with explicit parentheses `(...)`, optionally followed by a trailing closure.
- **Fields**:
  - `function`: `identifier`, `field_access`, or primary expression
  - `arguments`: `argument_list`
  - `closure`: `closure` (optional)
- **Examples**:
  ```groovy
  cleanWs()
  junit('**/target/*.xml')
  stage('Build') { ... }              // Trailing closure
  timeout(time: 10, unit: 'MINUTES') { ... }
  ```

### `command_expression`
A parenthesis-less method call (common in Jenkins steps and Gradle scripts).
- **Fields**:
  - `function`: `identifier` or `field_access`
  - `arguments`: `command_argument_list`
  - `chained_function`: subsequent identifiers in command chains (optional)
  - `closure`: trailing closure (optional)
- **Examples**:
  ```groovy
  sh 'mvn clean verify'
  echo 'Starting build'
  git url: 'https://...', branch: 'main'
  id 'java' version '1.0' // Chained command
  ```

### `closure_call_expression`
An invocation of a closure with no parentheses and no direct arguments (only the closure block itself).
- **Fields**:
  - `function`: `identifier` or `field_access`
  - `closure`: `closure`
- **Examples**:
  ```groovy
  pipeline { ... }
  steps { ... }
  script { ... }
  always { ... }
  ```

### `closure`
A Groovy closure block `{ ... }`.
- **Fields**:
  - `parameters`: `closure_parameters` (optional, preceding `->`)
- **Body**: zero or more statements
- **Examples**:
  ```groovy
  { println it }                          // Implicit 'it'
  { item -> println item }                // Explicit parameter
  { String key, int val = 0 -> println "$key=$val" } // Typed parameters with defaults
  ```

### `argument_list` and `command_argument_list`
Argument collections for `method_call` and `command_expression`.
- **Children**: Expressions or `named_argument` nodes.

### `named_argument`
Key-value pair argument (`key: value` or `'key': value`).
- **Fields**:
  - `name`: `identifier` or `string_literal`
  - `value`: expression
- **Example**: `time: 10`, `unit: 'MINUTES'`

---

## 4. Control Flow Statements

| Node Type | Fields | Syntax Example |
| :--- | :--- | :--- |
| `if_statement` | `condition`, `consequence`, `alternative` | `if (x > 0) { ... } else { ... }` |
| `while_statement` | `condition`, `body` | `while (running) { ... }` |
| `do_while_statement`| `body`, `condition` | `do { ... } while (check())` |
| `for_statement` | `init`, `condition`, `update`, `body` | `for (int i = 0; i < 10; i++) { ... }` |
| `for_in_statement` | `variable`, `collection`, `body` | `for (item in items) { ... }` |
| `switch_statement` | `value`, `body` | `switch (x) { case 1: ...; default: ... }` |
| `try_statement` | `resources`, `body` | `try { ... } catch (Exception e) { ... } finally { ... }` |
| `assert_statement` | expression, message | `assert value != null : 'Value missing'` |

---

## 5. Navigation & Member Access

| Node Type | Operator | Example | Description |
| :--- | :--- | :--- | :--- |
| `field_access` | `.` | `user.name` | Direct property access |
| `safe_field_access` | `?.` | `user?.address?.city` | Null-safe navigation |
| `spread_field_access` | `*.` | `users*.name` | Spread-dot operator |
| `direct_field_access` | `.@` | `user.@privateField` | Direct field access (bypassing getter) |
| `method_pointer` | `.&` | `String.&toUpperCase` | Closure method reference |
| `method_reference` | `::` | `System.out::println` | Java 8+ method reference |

---

## 6. Expressions & Operators

### `binary_expression`
Supports all standard Groovy binary operators:
- Arithmetic: `+`, `-`, `*`, `/`, `%`, `**` (power)
- Relational: `<`, `<=`, `>`, `>=`, `in`, `!in`, `as`
- Equality: `==`, `!=`, `<=>` (spaceship), `===`, `!==`
- Regex matching: `=~` (find), `==~` (match)
- Logical: `&&`, `||`
- Bitwise: `&`, `|`, `^`, `<<`, `>>`, `>>>`

### `ternary_expression` and `elvis_expression`
- Ternary: `condition ? ifTrue : ifFalse`
- Elvis (`?:`): `value ?: defaultValue`

### `range_expression`
Inclusive and half-open ranges:
- `1..10` (inclusive)
- `1..<10` (half-open end)
- `1<..10` (half-open start)
- `1<..<10` (half-open both ends)

---

## 7. Literals

### Strings
| Node Type | Syntax | Interpolation? |
| :--- | :--- | :--- |
| `single_quote_string` | `'text'` | No |
| `triple_single_quote_string` | `'''multiline text'''` | No |
| `double_quote_string` | `"Hello ${name}"` | Yes (`$.interpolation`) |
| `triple_double_quote_string` | `"""multiline ${name}"""` | Yes (`$.interpolation`) |
| `dollar_slashy_string` | `$/C:\path\to\${file}/$` | Yes (Regex & Windows path friendly) |

### Collections
- `list_literal`: `[1, 2, 'three']`
- `map_literal`: `[name: 'Logan', role: 'admin']` (contains `map_entry` children)
