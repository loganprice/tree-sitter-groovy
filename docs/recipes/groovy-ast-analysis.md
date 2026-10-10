# Recipe: Groovy Code Intelligence & AST Analysis

This recipe demonstrates how to analyze standard **Groovy** language features, including object hierarchies, traits, closures, safe navigation operators, and static code smells.

---

## 1. Class & Trait Hierarchies

### Finding All Class Declarations and Superclasses
```scm
(class_declaration
  name: (identifier) @class.name
  superclass: (type_identifier)? @class.superclass
  interfaces: (type_list)? @class.interfaces)
```

Matches:
```groovy
class CustomService extends AbstractService implements Auditable, Serializable {
    // ...
}
```

### Finding Traits
Groovy traits support method implementations and state composition:
```scm
(trait_declaration
  name: (identifier) @trait.name)
```

---

## 2. Closure Inspection

### Detecting Explicit vs. Implicit Closure Parameters
In Groovy, closures without an arrow `->` have an implicit parameter named `it`. Closures with `->` define explicit parameters:

```scm
; Match closures with explicit parameter lists
(closure
  parameters: (closure_parameters
    (closure_parameter
      type: (_)? @param.type
      name: (identifier) @param.name
      default_value: (_)? @param.default))
  "->" @arrow)
```

Matches:
```groovy
def adder = { int a, int b = 10 -> a + b }
```

---

## 3. Safe Navigation & Dynamic Operators

Groovy includes distinctive operators that can be analyzed for null safety and performance:

### Safe Navigation (`?.`)
Find all places using the null-safe navigation operator:
```scm
(safe_field_access
  object: (_) @target
  field: (identifier) @property)
```

Matches:
```groovy
def city = order?.customer?.address?.city
```

### Elvis Operator (`?:`)
Find fallback expressions:
```scm
(elvis_expression
  left: (_) @fallback_candidate
  right: (_) @default_value)
```

Matches:
```groovy
def name = inputName ?: 'Anonymous'
```

### Method Pointers (`.&`)
Detect closure method references:
```scm
(method_pointer
  object: (_) @target
  method: (identifier) @method_name)
```

Matches:
```groovy
def transform = String.&toUpperCase
```

---

## 4. Linting Rules & Code Smells

### 1. Direct Field Access Bypassing Encapsulation (`.@`)
In Groovy, `obj.@field` bypasses getter/setter methods to access the private field directly:
```scm
(direct_field_access
  object: (identifier) @obj
  field: (identifier) @field) @warning.encapsulation_bypass
```

### 2. Empty Catch Blocks
```scm
(catch_clause
  parameter: (catch_parameter) @param
  body: (block) @empty_block
  (#eq? @empty_block "{}"))
```

### 3. Broad Exception Handling
Match `catch (Exception e)` or `catch (Throwable t)`:
```scm
(catch_clause
  parameter: (catch_parameter
    type: (identifier) @type (#any-of? @type "Exception" "Throwable"))) @warning.broad_catch
```
