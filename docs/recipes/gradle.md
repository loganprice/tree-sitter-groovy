# Recipe: Gradle Build Script Analysis

This recipe demonstrates how to parse and analyze **Gradle** build scripts (`build.gradle`, `settings.gradle`) using `tree-sitter-groovy`.

---

## 1. Gradle DSL in the Groovy AST

Gradle build files rely heavily on Groovy's closure delegates and command expressions:

| Gradle Syntax | Groovy AST Node Type |
| :--- | :--- |
| `plugins { ... }` | `closure_call_expression` with closure body |
| `id 'java'` | `command_expression` (`function: id`, `arguments: 'java'`) |
| `id 'org.boot' version '3.2'` | `command_expression` with `chained_function: version` |
| `repositories { ... }` | `closure_call_expression` |
| `mavenCentral()` | `method_call` |
| `dependencies { ... }` | `closure_call_expression` |
| `implementation 'com.google.guava:guava:33.0.0-jre'` | `command_expression` (`function: implementation`) |
| `tasks.register('buildApp', Copy) { ... }` | `method_call` on `field_access` (`tasks.register`) |

---

## 2. Querying Plugins

To extract all plugins and versions applied in a `plugins { ... }` block:

```scm
(closure_call_expression
  function: (identifier) @_kw (#eq? @_kw "plugins")
  closure: (closure
    (expression_statement
      (command_expression
        function: (identifier) @_id (#eq? @_id "id")
        arguments: (command_argument_list
          (literal (string_literal) @plugin.id))
        (chained_function: (identifier) @_ver_kw
         arguments: (command_argument_list
           (literal (string_literal) @plugin.version)))?))))
```

Matches:
```groovy
plugins {
    id 'java'                                             // plugin.id = 'java'
    id 'org.springframework.boot' version '3.2.0'         // plugin.id = '...', plugin.version = '3.2.0'
}
```

---

## 3. Querying Dependencies

To find dependencies declared across all configurations (`implementation`, `testImplementation`, `api`, `runtimeOnly`):

```scm
(closure_call_expression
  function: (identifier) @_kw (#eq? @_kw "dependencies")
  closure: (closure
    (expression_statement
      [
        (command_expression
          function: (identifier) @dep.configuration
          arguments: (command_argument_list
            (literal (string_literal) @dep.coordinate)))
        (method_call
          function: (identifier) @dep.configuration
          arguments: (argument_list
            (literal (string_literal) @dep.coordinate)))
      ])))
```

Matches:
```groovy
dependencies {
    implementation 'org.slf4j:slf4j-api:2.0.9'
    testImplementation('org.junit.jupiter:junit-jupiter:5.10.1')
}
```

---

## 4. Querying Task Registrations

To capture registered task names and types:

```scm
(method_call
  function: (field_access
    object: (identifier) @_obj (#eq? @_obj "tasks")
    field: (identifier) @_method (#eq? @_method "register"))
  arguments: (argument_list
    (literal
      (string_literal) @task.name)
    (identifier)? @task.type)
  closure: (closure)? @task.body)
```

Matches:
```groovy
tasks.register('copyDocs', Copy) {
    from 'src/docs'
    into 'build/docs'
}
```

---

## 5. Querying Project Properties

To extract top-level property assignments:

```scm
(assignment_expression
  left: (identifier) @property.name
  right: (literal (string_literal) @property.value))
```

Matches:
```groovy
group = 'com.example.service'
version = '1.0.0-SNAPSHOT'
```
