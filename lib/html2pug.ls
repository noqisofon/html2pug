require! <[ fs path ]>
require! 'jsdom'
require! he: Ent
require! debug: meta-debug

debug = meta-debug \html2pug

ent-options =
  use-named-references: true

tab-width     = 2
use-tabs      = false
do-not-encode = false

valid-pug-id-re    = /^[\w\-]+$/
valid-pug-class-re = /^[\w\-]+$/

class Parser
  (@options = {}) ->
    debug 'Parser#constructor ( %o )', @options

  parse: (filename, callback) ->
    debug 'Parser#parse( %o, %o )', filename, callback
    if not filename
      callback 'null file'
    else
      config =
        done: callback

      debug '@options.input-type: %s', @options.input-type

      switch @options.input-type
      case \file
        config.html = fs.read-file-sync( filename, 'utf-8' )
      case \url
        config.url  = filename

      jsdom.env config

function is-valid-pug-id id
  id = if id then id.trim! else ''
  id and valid-pug-id-re.test( id )

function is-valid-pug-class-name class-name
  class-name = if class-name then class-name.trim! else ''
  class-name and valid-pug-class-re.test( class-name )

class Writer
  (@options = {}) ->
    debug 'Writer#constructor( %o )', @options
    @wrap-length   = @options.wrap-length ? 80
    @scalate       = @options.scalate ? false
    @attr-separator = if @scalate or not @options.attr-comma then ' ' else ', '

    debug '@attr-separator: %o', @attr-separator

    if @options.double
      @attr-quote     = '"'
      @non-attr-quote = "'"
    else
      @attr-quote     = "'"
      @non-attr-quote = '"'
    @attr-quote-escaped = "\\#{@attr-quote}"
    @no-empty-pipe      = not options.empty-pipe ? false

  tag-head: (node) ->
    debug 'Writer#tag-head( %o )', node
    result = if node.tag-name isnt \DIV then node.tag-name.to-lower-case! else ''

    debug '  --> result: %o', result

    result += "##{node.id}" if node.id and is-valid-pug-id node.id

    if node.has-attribute \class and node.get-attribute \class .length > 0
      valid-class-names = node.get-attribute \class .split /\s+/ .filter (item) -> item and is-valid-pug-class-name item
      result += ".#{valid-class-names.join('.')}"

    debug '  <-- result: %o', result

    result = \div if result.length is 0
    result

  tag-attribute: (node, indents = '') ->
    debug 'Writer#tag-attribute( %o, %o )', node, indents

    attrs = node.attributes
    debug 'attrs: %o', attrs

    if not attrs or attrs.length is 0
      ''
    else
      results = []

      for attr in attrs
        attr-name  = attr.node-name
        attr-value = attr.node-value

        debug 'attr := { name "%s", value: "%s" }', attr-name, attr-value

        if attr-name is \id and is-valid-pug-id( attr-value )
          debug ' should already be emitted as #id, ignore'
        else if attr-name is \class
          invalid-class-names = node.get-attribute \class .split /\s+/ .filter (item) -> item and not is-valid-pug-class-name
          results.push @build-tag-attr( attr-name, invalid-class-names.join( ' ' ) ) if invalid-class-names.length > 0
        else
          attr-value = attr-value.replace /(\r|\n)\s/g, "\\$1#{indents}"
          results.push @build-tag-attr( attr-name, attr-value )

      debug 'results         : %o', results
      debug 'results.join(%o): %o', @attr-separator, results.join( @attr-separator )
      if results.length > 0
        "(#{results.join(@attr-separator)})"
      else
        ''

  build-tag-attr: (attr-name, attr-value) ->
    debug 'Writer#build-tag-attr( %o, %o )', attr-name, attr-value
    if attr-value.index-of( @attr-quote ) is -1
      "#{attr-name}=#{@attr-quote}#{attr-value}#{@attr-quote}"
    else if attr-value.index-of( @non-attr-quote ) is -1
      "#{attr-name}=#{@non-attr-quote}#{attr-value}#{@non-attr-quote}"
    else
      attr-value = attr-value.replace( new RegExp( @attr-quote, \g), @attr-quote-escaped )
      "#{attr-name}=#{@attr-quote}#{attr-value}#{@attr-quote}"
      
  tag-text: (node) ->
    debug 'Writer#tag-text( %o )', node
    if node.first-child?.node-type isnt 3
      null
    else if node.first-child isnt node.last-child
      null
    else
      data = node.first-child.data

      if data.length > @wrap-length or data.match /\r|\n/
        null
      else
        data

  for-each-child: (parent, callback) !->
    debug 'Writer#for-each-child( %o, %o )', parent, callback
    if parent
      child = parent.first-child

      while child
        callback child
        child = child.next-sibling

  write-text-content: (node, output, options) !->
    debug 'Writer#write-text-content( %o, %o, %o )', node, output, options
    output.enter!

    @for-each-child node, (child) !~>
      @write-text child, output, options

    output.leave!

  write-text: (node, output, options) !->
    debug 'Writer#write-text( %o, %o, %o )', node, output, options
    debug 'node.node-type: %d', node.node-type
    debug 'node.data: %o', node.data
    if node.node-type is 3
      data = node.data or ''
      if data.length > 0
        lines = data.split /\r|\n/
        lines.for-each (line) !~>
          @write-text-line node, line, output, options

  write-text-line: (node, line, output, options = {}) !->
    debug 'Writer#write-text-line( %o, %o, %o, %o )', node, line, output, options

    pipe = options.pipe ? true
    trim = options.trim ? false
    wrap = options.wrap ? true

    debug 'pipe: %o, trim: %o, wrap: %o', pipe, trim, wrap

    encode-entity-ref = options.encode-entity-ref ? false
    escape-back-slash = options.escape-back-slash ? false

    debug 'encode-entity-ref: %o, escape-back-slash: %o', encode-entity-ref, escape-back-slash

    return if pipe and @no-empty-pipe and line.trim! .length is 0

    prefix = if pipe then '| ' else ''

    line = line.trim-left!  unless node?.previous-sibling?.node-type is 1
    line = line.trim-right! unless node?.next-sibling?.node-type is 1

    debug 'line: "%s"', line

    if line
      # escape backslash
      line = Ent.encode line, ent-options if encode-entity-ref
      line = line.replace '\\', '\\\\'    if escape-back-slash

      debug " ------ write '#{prefix}#{line}'"

      if not wrap or line.length <= @wrap-length
        output.writeln "#{prefix}#{line}"
      else
        lines = @break-line line
        if lines.length is 1
          output.writeln "#{prefix}#{line}"
        else
          lines.for-each (line) !~>
            @write-text-line node, line, output, options

  break-line: (line) ->
    debug 'Writer#Writer ( %s )', line
    return []       if not line or line.length is 0
    return [ line ] if line.search /\s+/ is -1

    lines = []
    words = line.split /\s+/
    line = ''

    while words.length
      word = words.shift!

      if line.length + word.length > @wrap-length
        lines.push line
        line = word
      else if line.length
        line += " #{word}"
      else
        line  = word

    if line.length
      lines.push line
    lines

public-id-doctype-names =
  '-//W3C//DTD XHTML 1.0 Transition//EN':  'transitional'
  '-//W3C//DTD XHTML 1.0 Strict//EN':      'strict'
  '-//W3C//DTD XHTML 1.0 Frameset//EN':    'frameset'
  '-//W3C//DTD XHTML 1.1//EN':             '1.1'
  '-//W3C//DTD XHTML Basic 1.1//EN':       'basic'
  '-//WAPFORUM//DTD XHTML Mobile 1.2//EN': 'mobile'

system-id-doctype-names =
  'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd':          'transitional'
  'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd':                'strict'
  'http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd':              'frameset'
  'http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd':                     '1.1'
  'http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd':               'basic'
  'http://www.openmobilealliance.org/TR/tech/DTD/xhtml-mobile12.dtd': 'mobile'

class Converter
  (@options = {}) ->
    debug 'Converter#constructor( %o )', @options
    @scalate = @options.scalate ? false
    @writer  = @options.writer ? new Writer( @options )
  
  write-document: (document, output) !->
    debug 'Converter#write-document(%o, %o)', document, output
    if document.doctype?
      doctype       = document.doctype
      doc-type-name = undefined
      public-id     = doctype.public-id
      system-id     = doctype.system-id

      debug ' ---'
      debug 'doctype      : %o', doctype
      debug 'doc-type-name: %s', doc-type-name
      debug 'public-id    : %s', public-id
      debug 'system-id    : %s', system-id

      if public-id? and public-id-doctype-names[public-id]?
        doc-type-name = public-id-doctype-names[public-id]
      else if system-id? and system-id-doctype-names[system-id]?
        doc-type-name = system-id-doctype-names[system-id]?
      else if doctype.name? and doctype.name.to-lower-case! is \html
        doc-type-name = \html

      debug ' ---'
      debug 'doctype      : %o', doctype
      debug 'doc-type-name: %s', doc-type-name
      debug 'public-id    : %s', public-id
      debug 'system-id    : %s', system-id

      output.writeln "doctype #{doc-type-name}" if doc-type-name?

    if document.document-element
      @write-child document, output, false
    else
      # document element is missing
      html-elements = document.get-element-by-tag-name \html
      @write-element html-elements[0], output if html-elements.length > 0

  write-element: (node, output) !->
    debug 'Converter#write-element(%o, %o)', node, output
    return if not node?.tag-name

    tag-name = node.tag-name.to-lower-case!
    tag-head = @writer.tag-head node
    tag-attr = @writer.tag-attribute node, output.indents
    tag-text = @writer.tag-text node

    debug ' ---'
    debug 'tag-name: %s', tag-name
    debug 'tag-head: %s', tag-head
    debug 'tag-attr: %s', tag-attr
    debug 'tag-text: %s', tag-text

    if tag-name is \script or tag-name is \style
      if node.has-attribute \src
        output.writeln "#{tag-head}#{tag-attr}"
        @writer.write-text-content node, output,
          pipe: false
          wrap: false
      else if tag-name is \script
        @write-script node, output, tag-head, tag-attr
      else if tag-name is \style
        @write-script node, output, tag-head, tag-attr
    else if tag-name is \conditional
      output.writeln "//#{node.get-attribute( \condition )}"
      @write-children node, output
    else if [ \pre ].index-of( tag-name ) isnt -1
      output.writeln "#{tag-head}#{tag-attr}."

      output.enter!

      first-line = true
      @writer.for-each-child node, (child) !->
        debug '  child.tag-name: %s', child.tag-name
        if child.node-type is 3
          data = child.data
          if data? and data.length > 0
            if first-line
              # suckup starting linefeed if any
              data = data.replace( /\r\n|\r|\n/, '' ) if data.search /\r\n|\r|\n/ is 0
              data = "\\n#{data}"
              first-line = false
            data = data.replace( /\t/g, '\\t' )
            data = data.replace( /\r\n|\r|\n/g, "\n#{output.indents}" )
            output.write data
      output.writeln!
      output.leave
    else if @options.body-less and ( tag-name in <[ html head body ]> )
      @write-child node, output, false
    else if tag-text
      if do-not-encode
        output.writeln "#{tag-head}#{tag-attr} #{tag-text}"
      else
        output.writeln "#{tag-head}#{tag-attr} #{Ent.encode( tag-text, ent-options )}"
    else
      output.writeln "#{tag-head}#{tag-attr}"
      @write-child node, output

  write-child: (parent, output, indent = true) !->
    debug 'Converter#write-child( %o, %o, %o )', parent, output, indent
    output.enter! if indent

    @writer.for-each-child parent, (child) ~>
      debug ' ---'
      node-type = child.node-type

      debug '  node-type: %o', node-type

      if node-type is 1            # element
        @write-element child, output
      else if node-type is 3       # text
        if parent._node-name is \code
          @write-text child, output,
            encode-entity-ref: true
            pipe: true
        else
          @write-text child, output,
            encode-entity-ref: if do-not-encode then false else true
      else if node-type is 8        # comment
        @write-comment child, output
    output.leave! if indent

  write-text: (node, output, options) !->
    debug 'Converter#write-text( %o, %o, %o )', node, output, options
    node.normalize!
    @writer.write-text node, output, options

  write-comment: (node, output) !->
    debug 'Converter#write-comment( %o, %o )', node, output
    condition = node.data.match /\s*\[(if\s+[^\]]]+)\]/

    debug 'condition: %o', condition

    if not condition
      data = node.data or ''
      if data.length is 0 or data.search( /\r|\n/ ) is -1
        output.writeln "// #{data.trim!}"
      else
        output.writeln '//'
        output.enter!
        lines = data.split /\r|\n/
        debug 'lines: %o', lines
        lines.for-each (line) ~>
          @writer.write-text-line node, line, output,
            pipe: false
            trim: true
            wrap: false
        output.leave!
    else
      @write-conditional node, condition[1], output

  write-conditional: (node, condition, output) !->
    debug 'Converter#write-conditional( %o, %o, %o )', node, condition, output
    inner-HTML = node.text-content.trim! .raplace /\s\[if\s+[^\]]+\]>\s*/, '' .replace '<![endif]', ''

    debug 'inner-HTML: %s', inner-HTML

    if inner-HTML.index-of( '<!' ) is 0
      condition = "[#{condition}] <!"
      inner-HTML = null

    conditional-elem = node.own-document.create-element \conditional
    conditional-elem.set-attribute \condition, condition
    conditional-elem.insert-before conditional-elem, node.next-sibling

  write-script: (node, output, tag-head, tag-attr) !->
    debug 'Converter#write-script( %o, %o, %o, %o )', node, output, tag-head, tag-attr
    if @scalate
      output.writeln ':javascript'
      @writer.write-text-content node, output,
        pipe: false
        wrap: false
    else
      output.writeln "#{tag-head}#{tag-attr}"
      @writer.write-text-content node, output,
        pipe: false
        trim: true
        wrap: false
        escape-back-slash: true

  write-style: (node, output, tag-head, tag-attr) !->
    debug 'Converter#write-style( %o, %o, %o, %o )', node, output, tag-head, tag-attr
    if @scalate
      output.writeln ':css'
      @writer.write-text-content node, output,
        pipe: false
        wrap : false
    else
      output.writeln '#{tag-head}#{tag-attr}'
      @writer.write-text-content node, output,
        pipe: false
        trim: true
        wrap : false

class Output
  (@indents = '') ->

  enter: !->
    debug 'Output#enter'
    if use-tabs
      @indents += '\t'
    else
      @indents += ' ' * tab-width

  write: (data, indent = true) !->

  writeln: (data, indent = true) !->
  
  leave: !->
    debug 'Output#leave'
    if use-tabs
      @indents = @indents.substring 1
    else
      @indents = @indents.substring tab-width

class StringOutput extends Output
  ->
    super!
    @fragments = []

  write: (data, indent = true) !->
    debug 'StringOutput#write( %o, %o )', data, indent
    data ?= ''
    if indent
      @gragments.push @indents + data
    else
      @gragments.push data

  writeln: (data, indent = true) !->
    debug 'StringOutput#writeln( %o, %o )', data, indent
    data ?= ''
    if indent
      @gragments.push @indents + data + '\n'
    else
      @gragments.push data + '\n'

  final: ->
    result = @fragments.join ''
    @fragments = []
    result

class StreamOutput extends Output
  (@stream) ->
    super!

  write: (data, indent = true) !->
    debug 'StreamOutput#write( %o, %o )', data, indent
    data ?= ''
    if indent
      @stream.write @indents + data
    else
      @stream.write data

  writeln: (data, indent = true) !->
    debug 'StreamOutput#writeln( %o, %o )', data, indent
    data ?= ''
    if indent
      @stream.write @indents + data + '\n'
    else
      @stream.write data + '\n'

export Output
export StringOutput
export Converter
export Writer

!function apply-options (options)
  ent-options.use-named-references = options.numeric if options.numeric?
  debug 'ent-options.use-named-references: %o', ent-options.use-named-references

  tab-width     := parse-int options.tab-width if options.tab-width?
  debug 'tab-width:     %o', tab-width

  use-tabs      := options.use-tabs            if options.use-tabs?
  debug 'use-tabs:      %o', use-tabs

  do-not-encode := options.do-not-encode       if options.do-not-encode?
  debug 'do-not-encode: %o', do-not-encode

export Parser
export StreamOutput

export !function convert (input, output, options = {})
  debug 'convert( %o, %o, %o )', input, output, options

  apply-options options
  
  output         ?= new StreamOutput( process.stdout )

  options.parser ?= new Parser( options )
  options.parser.parse input, (errors, window) !->
    debug 'parse callback ( %o, %o )', errors, window
    if errors?.length
      errors
    else
      options.converter ?= new Converter( options )
      options.converter.write-document window.document, output

export !function convert-html (html, options = {}, callback)
  apply-options options

  output = options.output ? new StringOutput()

  options.parser ?= new Parser( options )
  options.parser.parse input, (errors, window) !->
    if errors?.length
      debug errors
    else
      options.converter = new Converter( options )
      options.converter.write-document window.document, output
      callback null, output.final! if callback?

export !function convert-document (document, options = {}, callback)
  apply-options options

  output = options.output ? new StringOutput()
  options.converter ?= new Converter( options )
  options.converter.write-document document, output
  callback null, output.final! if callback?
