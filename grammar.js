/**
 * @file Groovy grammar for tree-sitter
 * @author Logan Price
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  COMMENT: 0,
  ASSIGN: 1,        // = += -= ...
  COMMAND: 2,       // id 'arg', 'arg' (parenthesis-less calls)
  CLOSURE_CALL: 3,  // func { ... }
  TERNARY: 4,       // ? :
  ELVIS: 5,         // ?:
  LOGICAL_OR: 6,    // ||
  LOGICAL_AND: 7,   // &&
  BITWISE_OR: 8,    // |
  BITWISE_XOR: 9,   // ^
  BITWISE_AND: 10,  // &
  EQUALITY: 11,     // == != <=> === !== =~ ==~
  RELATIONAL: 12,   // < <= > >= in !in instanceof !instanceof as
  RANGE: 13,        // .. ..< <.. <..<
  SHIFT: 14,        // << >> >>>
  ADD: 15,          // + -
  MULT: 16,         // * / %
  POWER: 17,        // **
  UNARY: 18,        // ++ -- + - ! ~ cast
  POSTFIX: 19,      // expr++ expr-- expr[]
  CALL: 20,         // expr(...)
  NAVIGATION: 21,   // . ?. *. .& .@ ::
  PRIMARY: 22,
};

module.exports = grammar({
  name: 'groovy',

  extras: $ => [
    /\s/,
    $.line_comment,
    $.block_comment,
  ],

  word: $ => $.identifier,

  conflicts: $ => [
    [$._expression, $._access_object],
    [$._command_argument, $._access_object],
    [$._expression, $._command_argument],
    [$._expression, $._command_argument, $._access_object],
    [$._primary_expression, $._type],
    [$._primary_expression, $._command_argument],
    [$._primary_expression, $.for_in_statement],
    [$.variable_declarator, $.method_declaration],
    [$.method_declaration, $.constructor_declaration],
    [$.variable_declarator, $.method_declaration, $.constructor_declaration],
    [$.variable_declarator, $._type],
    [$.variable_declaration, $._type],
    [$.method_declaration, $._type],
    [$.variable_declaration, $.method_declaration, $._type],
    [$.variable_declarator, $.closure_parameter],
    [$.formal_parameters, $.argument_list],
    [$.formal_parameter, $._primary_expression],
    [$.argument_list, $.parenthesized_expression],
    [$.field_access, $.scoped_type_identifier],
  ],

  rules: {
    source_file: $ => seq(
      optional($.shebang),
      repeat(choice($._statement, ';'))
    ),

    shebang: _ => token(seq('#!', /[^\n]*/)),

    line_comment: _ => token(seq('//', /[^\n]*/)),

    block_comment: _ => token(seq(
      '/*',
      /[^*]*\*+([^/*][^*]*\*+)*/,
      '/'
    )),

    // Statements
    _statement: $ => choice(
      $.package_declaration,
      $.import_declaration,
      $.class_declaration,
      $.interface_declaration,
      $.trait_declaration,
      $.enum_declaration,
      $.record_declaration,
      $.variable_declaration,
      $.method_declaration,
      $.constructor_declaration,
      $.if_statement,
      $.while_statement,
      $.do_while_statement,
      $.for_statement,
      $.for_in_statement,
      $.switch_statement,
      $.try_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.throw_statement,
      $.assert_statement,
      $.labeled_statement,
      $.expression_statement,
      $.block
    ),

    package_declaration: $ => seq(
      repeat($.annotation),
      'package',
      field('name', $.qualified_identifier)
    ),

    import_declaration: $ => seq(
      'import',
      optional('static'),
      field('name', $.import_name),
      optional(seq('as', field('alias', $.identifier)))
    ),

    import_name: $ => seq(
      $.identifier,
      repeat(seq('.', $.identifier)),
      optional(seq('.', alias('*', $.wildcard_import)))
    ),

    qualified_identifier: $ => seq(
      $.identifier,
      repeat(seq('.', $.identifier))
    ),

    block: $ => prec(1, seq(
      '{',
      repeat(choice($._statement, ';')),
      '}'
    )),

    expression_statement: $ => seq(
      repeat($.annotation),
      $._expression
    ),

    labeled_statement: $ => prec(1, seq(
      field('label', $.identifier),
      ':',
      field('statement', choice($._statement, $._expression))
    )),

    // Control Flow
    if_statement: $ => prec.right(seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $._statement),
      optional(seq('else', field('alternative', $._statement)))
    )),

    while_statement: $ => seq(
      'while',
      field('condition', $.parenthesized_expression),
      field('body', $._statement)
    ),

    do_while_statement: $ => prec(2, seq(
      'do',
      field('body', $._statement),
      'while',
      field('condition', $.parenthesized_expression)
    )),

    for_statement: $ => seq(
      'for',
      '(',
      optional(field('init', choice($.variable_declaration, $._expression))),
      ';',
      optional(field('condition', $._expression)),
      ';',
      optional(field('update', $._expression)),
      ')',
      field('body', $._statement)
    ),

    for_in_statement: $ => seq(
      'for',
      '(',
      optional(field('type', choice('def', 'var', $._type))),
      field('variable', $.identifier),
      choice('in', ':'),
      field('collection', $._expression),
      ')',
      field('body', $._statement)
    ),

    switch_statement: $ => seq(
      'switch',
      field('value', $.parenthesized_expression),
      field('body', $.switch_block)
    ),

    switch_block: $ => seq(
      '{',
      repeat(choice($.case_clause, $.default_clause)),
      '}'
    ),

    case_clause: $ => prec.left(seq(
      'case',
      field('value', $._expression),
      ':',
      repeat(choice($._statement, ';'))
    )),

    default_clause: $ => prec.left(seq(
      'default',
      ':',
      repeat(choice($._statement, ';'))
    )),

    try_statement: $ => seq(
      'try',
      optional(field('resources', $.resource_specification)),
      field('body', $.block),
      repeat($.catch_clause),
      optional($.finally_clause)
    ),

    resource_specification: $ => seq(
      '(',
      sep1($.resource, ';'),
      optional(';'),
      ')'
    ),

    resource: $ => seq(
      optional(field('type', $._type)),
      field('name', $.identifier),
      '=',
      field('value', $._expression)
    ),

    catch_clause: $ => seq(
      'catch',
      '(',
      field('parameter', $.catch_parameter),
      ')',
      field('body', $.block)
    ),

    catch_parameter: $ => seq(
      field('type', sep1($._type, '|')),
      field('name', $.identifier)
    ),

    finally_clause: $ => seq(
      'finally',
      field('body', $.block)
    ),

    return_statement: $ => prec.right(seq(
      'return',
      optional($._expression)
    )),

    break_statement: $ => prec.right(seq(
      'break',
      optional(field('label', $.identifier))
    )),

    continue_statement: $ => prec.right(seq(
      'continue',
      optional(field('label', $.identifier))
    )),

    throw_statement: $ => seq(
      'throw',
      $._expression
    ),

    assert_statement: $ => prec.right(seq(
      'assert',
      field('condition', $._expression),
      optional(seq(':', field('message', $._expression)))
    )),

    // Declarations
    class_declaration: $ => seq(
      repeat($.annotation),
      repeat($.modifier),
      'class',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      optional($.superclass),
      optional($.interfaces),
      field('body', $.class_body)
    ),

    interface_declaration: $ => seq(
      repeat($.annotation),
      repeat($.modifier),
      'interface',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      optional($.extends_interfaces),
      field('body', $.class_body)
    ),

    trait_declaration: $ => seq(
      repeat($.annotation),
      repeat($.modifier),
      'trait',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      optional($.extends_interfaces),
      optional($.interfaces),
      field('body', $.class_body)
    ),

    enum_declaration: $ => seq(
      repeat($.annotation),
      repeat($.modifier),
      'enum',
      field('name', $.identifier),
      optional($.interfaces),
      field('body', $.enum_body)
    ),

    enum_body: $ => seq(
      '{',
      optional(sep1($.enum_constant, ',')),
      optional(','),
      optional(seq(';', repeat(choice($._class_member, ';')))),
      '}'
    ),

    enum_constant: $ => seq(
      repeat($.annotation),
      field('name', $.identifier),
      optional($.argument_list)
    ),

    record_declaration: $ => seq(
      repeat($.annotation),
      repeat($.modifier),
      'record',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      field('parameters', $.formal_parameters),
      optional($.interfaces),
      field('body', $.class_body)
    ),

    superclass: $ => prec(PREC.CLOSURE_CALL + 1, seq('extends', field('type', $._type))),

    interfaces: $ => prec(PREC.CLOSURE_CALL + 1, seq('implements', sep1(field('type', $._type), ','))),

    extends_interfaces: $ => prec(PREC.CLOSURE_CALL + 1, seq('extends', sep1(field('type', $._type), ','))),

    class_body: $ => seq(
      '{',
      repeat(choice($._class_member, ';')),
      '}'
    ),

    _class_member: $ => choice(
      $.variable_declaration,
      $.method_declaration,
      $.constructor_declaration,
      $.class_declaration,
      $.interface_declaration,
      $.trait_declaration,
      $.enum_declaration,
      $.record_declaration,
      $.static_initializer,
      $.block
    ),

    static_initializer: $ => seq('static', $.block),

    variable_declaration: $ => prec.right(seq(
      repeat($.annotation),
      choice(
        seq(repeat($.modifier), choice('def', 'var'), sep1($.variable_declarator, ',')),
        seq(repeat1($.modifier), optional(field('type', $._type)), sep1($.variable_declarator, ',')),
        seq(field('type', choice($.primitive_type, $.generic_type, $.array_type, $.identifier)), sep1($.initialized_variable_declarator, ','))
      )
    )),

    initialized_variable_declarator: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $._expression)
    ),

    variable_declarator: $ => seq(
      field('name', $.identifier),
      optional(seq('=', field('value', $._expression)))
    ),

    method_declaration: $ => prec.right(seq(
      repeat($.annotation),
      choice(
        seq(repeat($.modifier), optional(field('type_parameters', $.type_parameters)), 'def', field('name', choice($.identifier, $.string_literal))),
        seq(repeat($.modifier), optional(field('type_parameters', $.type_parameters)), field('return_type', $.primitive_type), field('name', choice($.identifier, $.string_literal))),
        seq(repeat1($.modifier), optional(field('type_parameters', $.type_parameters)), optional(field('return_type', $._type)), field('name', choice($.identifier, $.string_literal)))
      ),
      field('parameters', $.formal_parameters),
      optional($.throws_clause),
      field('body', choice($.block, ';'))
    )),

    constructor_declaration: $ => prec.right(seq(
      repeat($.annotation),
      repeat($.modifier),
      field('name', $.identifier),
      field('parameters', $.formal_parameters),
      optional($.throws_clause),
      field('body', $.block)
    )),

    formal_parameters: $ => seq(
      '(',
      optional(sep1($.formal_parameter, ',')),
      ')'
    ),

    formal_parameter: $ => seq(
      repeat($.annotation),
      repeat($.modifier),
      optional(field('type', choice('def', $._type))),
      optional(alias(token.immediate('...'), $.varargs)),
      field('name', $.identifier),
      optional(seq('=', field('default_value', $._expression)))
    ),

    throws_clause: $ => seq('throws', sep1($._type, ',')),

    modifier: _ => choice(
      'public',
      'protected',
      'private',
      'static',
      'abstract',
      'final',
      'native',
      'synchronized',
      'transient',
      'volatile',
      'strictfp',
      'default'
    ),

    annotation: $ => prec.right(seq(
      '@',
      field('name', $.qualified_identifier),
      optional(field('arguments', $.annotation_argument_list))
    )),

    annotation_argument_list: $ => seq(
      '(',
      optional(sep1(choice($.annotation_value_pair, $.named_argument, $._expression), ',')),
      ')'
    ),

    annotation_value_pair: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $._expression)
    ),

    type_parameters: $ => seq(
      '<',
      sep1($.type_parameter, ','),
      '>'
    ),

    type_parameter: $ => seq(
      repeat($.annotation),
      field('name', $.identifier),
      optional(seq('extends', sep1($._type, '&')))
    ),

    // Types
    scoped_type_identifier: $ => prec.dynamic(-1, prec.left(PREC.NAVIGATION, seq(
      choice($.identifier, $.scoped_type_identifier),
      '.',
      $.identifier
    ))),

    _type: $ => choice(
      $.primitive_type,
      $.array_type,
      $.generic_type,
      $.scoped_type_identifier,
      $.identifier
    ),

    primitive_type: _ => choice(
      'boolean',
      'byte',
      'char',
      'short',
      'int',
      'long',
      'float',
      'double',
      'void'
    ),

    array_type: $ => prec(PREC.POSTFIX + 1, seq(
      field('element', $._type),
      '[',
      ']'
    )),

    generic_type: $ => prec(PREC.POSTFIX, seq(
      field('type', choice($.scoped_type_identifier, $.identifier)),
      field('type_arguments', $.type_arguments)
    )),

    type_arguments: $ => seq(
      '<',
      sep1(choice($._type, $.wildcard_type), ','),
      '>'
    ),

    wildcard_type: $ => seq(
      '?',
      optional(seq(choice('extends', 'super'), $._type))
    ),

    // Expressions
    _expression: $ => choice(
      $.assignment_expression,
      $.binary_expression,
      $.unary_expression,
      $.ternary_expression,
      $.elvis_expression,
      $.type_cast_expression,
      $.instanceof_expression,
      $.closure_call_expression,
      $.command_expression,
      $.method_call,
      $.field_access,
      $.safe_field_access,
      $.spread_field_access,
      $.direct_field_access,
      $.method_pointer,
      $.method_reference,
      $.subscript_expression,
      $.range_expression,
      $._primary_expression
    ),

    _primary_expression: $ => choice(
      $.identifier,
      $.literal,
      $.closure,
      $.list_literal,
      $.map_literal,
      $.parenthesized_expression,
      $.object_creation_expression
    ),

    parenthesized_expression: $ => seq(
      '(',
      $._expression,
      ')'
    ),

    // Closures
    closure: $ => seq(
      '{',
      optional(seq(
        field('parameters', $.closure_parameters),
        '->'
      )),
      repeat(choice($._statement, ';')),
      '}'
    ),

    closure_parameters: $ => sep1($.closure_parameter, ','),

    closure_parameter: $ => seq(
      optional(field('type', choice('def', $._type))),
      field('name', $.identifier),
      optional(seq('=', field('default_value', $._expression)))
    ),

    // Method Calls & DSL Invocations
    method_call: $ => prec.right(PREC.CALL, seq(
      field('function', choice($.identifier, $.field_access, $.safe_field_access, $.spread_field_access, $._primary_expression)),
      field('arguments', $.argument_list),
      optional(field('closure', $.closure))
    )),

    closure_call_expression: $ => prec(PREC.CLOSURE_CALL, seq(
      field('function', choice($.identifier, $.field_access, $.safe_field_access)),
      field('closure', $.closure)
    )),

    // Command expression (parenthesis-less method calls, e.g. Gradle 'id "java"', Jenkins 'sh "make"')
    command_expression: $ => prec.left(PREC.COMMAND, seq(
      field('function', choice($.identifier, $.field_access, $.safe_field_access)),
      field('arguments', $.command_argument_list),
      repeat(seq(
        field('chained_function', $.identifier),
        field('arguments', $.command_argument_list)
      )),
      optional(field('closure', $.closure))
    )),

    _command_argument: $ => choice(
      $.named_argument,
      $.literal,
      $.identifier,
      $.field_access,
      $.safe_field_access,
      $.method_call,
      $.closure,
      $.list_literal,
      $.map_literal
    ),

    command_argument_list: $ => prec.left(PREC.COMMAND, seq(
      $._command_argument,
      repeat(seq(',', choice($._command_argument, $._expression)))
    )),

    argument_list: $ => seq(
      '(',
      optional(sep1(choice($.named_argument, $._expression), ',')),
      ')'
    ),

    named_argument: $ => prec(1, seq(
      field('name', choice($.identifier, $.string_literal)),
      ':',
      field('value', $._expression)
    )),

    // Navigation and Member Access
    _access_object: $ => choice(
      $._primary_expression,
      $.method_call,
      $.closure_call_expression,
      $.subscript_expression,
      $.field_access,
      $.safe_field_access,
      $.spread_field_access
    ),

    field_access: $ => prec.left(PREC.NAVIGATION, seq(
      field('object', choice($.identifier, $._access_object)),
      '.',
      field('field', choice($.identifier, $.string_literal))
    )),

    safe_field_access: $ => prec.left(PREC.NAVIGATION, seq(
      field('object', $._access_object),
      '?.',
      field('field', choice($.identifier, $.string_literal))
    )),

    spread_field_access: $ => prec.left(PREC.NAVIGATION, seq(
      field('object', $._access_object),
      '*.',
      field('field', choice($.identifier, $.string_literal))
    )),

    direct_field_access: $ => prec.left(PREC.NAVIGATION, seq(
      field('object', $._access_object),
      '.@',
      field('field', $.identifier)
    )),

    method_pointer: $ => prec.left(PREC.NAVIGATION, seq(
      field('object', $._access_object),
      '.&',
      field('method', choice($.identifier, $.string_literal))
    )),

    method_reference: $ => prec.left(PREC.NAVIGATION, seq(
      field('object', $._access_object),
      '::',
      field('method', $.identifier)
    )),

    subscript_expression: $ => prec(PREC.POSTFIX, seq(
      field('object', $._access_object),
      '[',
      field('index', sep1($._expression, ',')),
      ']'
    )),

    object_creation_expression: $ => prec.right(PREC.CALL, seq(
      'new',
      field('type', $._type),
      choice(
        seq(field('arguments', $.argument_list), optional(field('closure', $.closure))),
        seq(field('closure', $.closure))
      )
    )),

    assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
      field("left", choice(
        $.field_access,
        $.safe_field_access,
        $.subscript_expression,
        $.multiple_assignment_target,
        prec(-1, $.identifier)
      )),
      field('operator', choice('=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '^=', '|=', '?=')),
      field('right', $._expression)
    )),

    multiple_assignment_target: $ => seq(
      '(',
      $.identifier,
      repeat1(seq(',', $.identifier)),
      ')'
    ),

    ternary_expression: $ => prec.right(PREC.TERNARY, seq(
      field('condition', $._expression),
      '?',
      field('consequence', $._expression),
      ':',
      field('alternative', $._expression)
    )),

    elvis_expression: $ => prec.right(PREC.ELVIS, seq(
      field('left', $._expression),
      '?:',
      field('right', $._expression)
    )),

    binary_expression: $ => {
      /** @type {Array<[RuleOrLiteral, number]>} */
      const table = [
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.BITWISE_OR],
        ['^', PREC.BITWISE_XOR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUALITY],
        ['!=', PREC.EQUALITY],
        ['<=>', PREC.EQUALITY],
        ['===', PREC.EQUALITY],
        ['!==', PREC.EQUALITY],
        ['=~', PREC.EQUALITY],
        ['==~', PREC.EQUALITY],
        ['<', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['in', PREC.RELATIONAL],
        ['!in', PREC.RELATIONAL],
        ['as', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
        ['>>>', PREC.SHIFT],
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULT],
        ['/', PREC.MULT],
        ['%', PREC.MULT],
        ['**', PREC.POWER],
      ];

      return choice(...table.map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $._expression),
          field('operator', operator),
          field('right', $._expression)
        ))
      ));
    },

    instanceof_expression: $ => prec(PREC.RELATIONAL, seq(
      field('left', $._expression),
      choice('instanceof', '!instanceof'),
      field('right', $._type)
    )),

    range_expression: $ => prec.left(PREC.RANGE, seq(
      field('start', $._expression),
      field('operator', choice('..', '..<', '<..', '<..<')),
      field('end', $._expression)
    )),

    unary_expression: $ => choice(
      prec(PREC.UNARY, seq(
        field('operator', choice('+', '-', '++', '--', '!', '~')),
        field('operand', $._expression)
      )),
      prec.left(PREC.POSTFIX, seq(
        field('operand', $._expression),
        field('operator', choice('++', '--'))
      ))
    ),

    type_cast_expression: $ => prec(PREC.UNARY, seq(
      '(',
      field('type', $._type),
      ')',
      field('operand', $._expression)
    )),

    // Collections
    list_literal: $ => seq(
      '[',
      optional(sep1($._expression, ',')),
      optional(','),
      ']'
    ),

    map_literal: $ => seq(
      '[',
      choice(
        ':', // empty map [:]
        seq(sep1(choice($.map_entry, $.named_argument), ','), optional(','))
      ),
      ']'
    ),

    map_entry: $ => seq(
      field('key', choice(
        $.identifier,
        $.string_literal,
        $.number_literal,
        seq('(', $._expression, ')')
      )),
      ':',
      field('value', $._expression)
    ),

    // Literals
    literal: $ => choice(
      $.number_literal,
      $.string_literal,
      $.boolean_literal,
      $.null_literal,
      $.regex_literal
    ),

    number_literal: _ => token(choice(
      // Hex
      /0[xX][0-9a-fA-F](_?[0-9a-fA-F])*[lLgG]?/,
      // Binary
      /0[bB][01](_?[01])*[lLgG]?/,
      // Octal
      /0[0-7]+[lLgG]?/,
      // Decimal / Float
      /[0-9](_?[0-9])*\.[0-9](_?[0-9])*([eE][+-]?[0-9](_?[0-9])*)?[fFdDmM]?/,
      /[0-9](_?[0-9])*[eE][+-]?[0-9](_?[0-9])*[fFdDmM]?/,
      /[0-9](_?[0-9])*[lLgGfFdDmM]?/
    )),

    boolean_literal: _ => choice('true', 'false'),

    null_literal: _ => 'null',

    // Strings
    string_literal: $ => choice(
      $.single_quote_string,
      $.triple_single_quote_string,
      $.double_quote_string,
      $.triple_double_quote_string,
      $.dollar_slashy_string
    ),

    single_quote_string: _ => token(seq(
      "'",
      repeat(choice(/[^'\\\n]+/, seq('\\', /./))),
      "'"
    )),

    triple_single_quote_string: _ => token(seq(
      "'''",
      repeat(choice(/[^'\\]+/, /'[^']/, /''[^']/, seq('\\', /./))),
      "'''"
    )),

    double_quote_string: $ => seq(
      '"',
      repeat(choice(
        $.string_content,
        $.escape_sequence,
        $.interpolation
      )),
      '"'
    ),

    triple_double_quote_string: $ => seq(
      '"""',
      repeat(choice(
        $.triple_string_content,
        $.escape_sequence,
        $.interpolation
      )),
      '"""'
    ),

    dollar_slashy_string: $ => seq(
      '$/',
      repeat(choice(
        $.dollar_slashy_content,
        $.interpolation
      )),
      '/$'
    ),

    string_content: _ => token.immediate(prec(1, /[^"\\$]+/)),

    triple_string_content: _ => token.immediate(prec(1, /([^"\\$]|"[^"]|""[^"])+/)),

    dollar_slashy_content: _ => token.immediate(prec(1, /([^/\$]|\/[^\$]|\$\$|\/\/)+/)),

    escape_sequence: _ => token.immediate(seq('\\', /./)),

    interpolation: $ => choice(
      seq('$', field('variable', alias($.identifier, $.variable_ref))),
      seq('${', field('expression', $._expression), '}')
    ),

    regex_literal: _ => token(seq(
      '/',
      /[^/*\n\\](\\.|[^/\n\\])*/,
      '/'
    )),

    identifier: _ => /[a-zA-Z_$][a-zA-Z0-9_$]*/,
  }
});

/**
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 * @returns {Rule}
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
