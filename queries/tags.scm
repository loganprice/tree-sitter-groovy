; Classes and Interfaces
(class_declaration
  name: (identifier) @name) @definition.class

(interface_declaration
  name: (identifier) @name) @definition.interface

(trait_declaration
  name: (identifier) @name) @definition.interface

(enum_declaration
  name: (identifier) @name) @definition.class

(record_declaration
  name: (identifier) @name) @definition.class

; Methods and Constructors
(method_declaration
  name: (identifier) @name) @definition.method

(constructor_declaration
  name: (identifier) @name) @definition.method

; Gradle Tasks (e.g. tasks.register('myTask', ...))
(method_call
  function: (field_access
    object: (identifier) @_obj (#match? @_obj "^tasks$")
    field: (identifier) @_method (#match? @_method "^(register|create|named)$"))
  arguments: (argument_list
    (literal
      (string_literal
        [
          (single_quote_string)
          (double_quote_string)
        ] @name)))) @definition.function

; Jenkinsfile Pipeline Stages (e.g. stage('Build') { ... })
(method_call
  function: (identifier) @_stage (#match? @_stage "^stage$")
  arguments: (argument_list
    (literal
      (string_literal
        [
          (single_quote_string)
          (double_quote_string)
        ] @name)))) @definition.function
