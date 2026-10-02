; Keywords
[
  "package"
  "import"
  "static"
  "as"
  "class"
  "interface"
  "trait"
  "enum"
  "record"
  "extends"
  "implements"
  "def"
  "var"
  "throws"
  "new"
] @keyword

[
  "if"
  "else"
  "switch"
  "case"
  "default"
  "while"
  "do"
  "for"
  "in"
  "try"
  "catch"
  "finally"
  "return"
  "break"
  "continue"
  "throw"
  "assert"
] @keyword.control

[
  "public"
  "protected"
  "private"
  "abstract"
  "final"
  "native"
  "synchronized"
  "transient"
  "volatile"
  "strictfp"
] @keyword.modifier

; Types
(primitive_type) @type.builtin

(generic_type
  type: (identifier) @type)

(generic_type
  type: (scoped_type_identifier
    (identifier) @type))

(scoped_type_identifier
  (identifier) @type)

(class_declaration
  name: (identifier) @type.definition)

(interface_declaration
  name: (identifier) @type.definition)

(trait_declaration
  name: (identifier) @type.definition)

(enum_declaration
  name: (identifier) @type.definition)

(record_declaration
  name: (identifier) @type.definition)

; Literals
(number_literal) @number
(boolean_literal) @boolean
(null_literal) @constant.builtin
(regex_literal) @string.regex

[
  (single_quote_string)
  (triple_single_quote_string)
  (double_quote_string)
  (triple_double_quote_string)
  (dollar_slashy_string)
] @string

(escape_sequence) @string.escape
(interpolation) @embedded

; Comments
(line_comment) @comment.line
(block_comment) @comment.block
(shebang) @comment.line

; Annotations
(annotation
  name: (qualified_identifier) @attribute)
"@" @attribute

; Function and Method Declarations
(method_declaration
  name: (identifier) @function.method)

(constructor_declaration
  name: (identifier) @constructor)

; Method & Function Calls
(method_call
  function: (identifier) @function.call)

(method_call
  function: (field_access
    field: (identifier) @function.method.call))

(command_expression
  function: (identifier) @function.call)

(command_expression
  function: (field_access
    field: (identifier) @function.method.call))

(command_expression
  chained_function: (identifier) @function.call)

(closure_call_expression
  function: (identifier) @function.call)

(closure_call_expression
  function: (field_access
    field: (identifier) @function.method.call))

; Parameters
(formal_parameter
  name: (identifier) @variable.parameter)

(closure_parameter
  name: (identifier) @variable.parameter)

(catch_parameter
  name: (identifier) @variable.parameter)

; Variables
(variable_declarator
  name: (identifier) @variable)

(initialized_variable_declarator
  name: (identifier) @variable)

(for_in_statement
  variable: (identifier) @variable)

; Properties & Fields
(field_access
  field: (identifier) @property)

(safe_field_access
  field: (identifier) @property)

(spread_field_access
  field: (identifier) @property)

(direct_field_access
  field: (identifier) @property)

; Named Arguments
(named_argument
  name: (identifier) @property)

; Enum Constants
(enum_constant
  name: (identifier) @constant)

; Operators
[
  "="
  "+="
  "-="
  "*="
  "/="
  "%="
  "**="
  "<<="
  ">>="
  ">>>="
  "&="
  "^="
  "|="
  "?="
  "=="
  "!="
  "<=>"
  "==="
  "!=="
  "=~"
  "==~"
  "<"
  "<="
  ">"
  ">="
  "instanceof"
  "!instanceof"
  "!"
  "&&"
  "||"
  "&"
  "|"
  "^"
  "~"
  "+"
  "-"
  "*"
  "/"
  "%"
  "**"
  "<<"
  ">>"
  ">>>"
  "++"
  "--"
  "?"
  ":"
  "?:"
  "?."
  "*."
  ".@"
  ".&"
  "::"
  ".."
  "..<"
  "<.."
  "<..<"
  "->"
] @operator

; Punctuation
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ";"
  "."
] @punctuation.delimiter
