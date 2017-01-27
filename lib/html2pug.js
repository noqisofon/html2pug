var fs, path, jsdom, Ent, metaDebug, debug, entOptions, tabWidth, useTabs, doNotEncode, validPugIdRe, validPugClassRe, Parser, Writer, publicIdDoctypeNames, systemIdDoctypeNames, Converter, Output, StringOutput, StreamOutput, out$ = typeof exports != 'undefined' && exports || this;
fs = require('fs');
path = require('path');
jsdom = require('jsdom');
Ent = require('he');
metaDebug = require('debug');
debug = metaDebug('html2pug');
entOptions = {
  useNamedReferences: true
};
tabWidth = 2;
useTabs = false;
doNotEncode = false;
validPugIdRe = /^[\w\-]+$/;
validPugClassRe = /^[\w\-]+$/;
Parser = (function(){
  Parser.displayName = 'Parser';
  var prototype = Parser.prototype, constructor = Parser;
  function Parser(options){
    this.options = options != null
      ? options
      : {};
  }
  Parser.prototype.parse = function(filename, callback){
    var config;
    if (!filename) {
      return callback('null file');
    } else {
      config = {
        done: callback
      };
      switch (this.options.inputType) {
      case 'file':
        config.html = fs.readFileSync(filename, 'utf-8');
        break;
      case 'url':
        config.url = filename;
      }
      return jsdom.env(config);
    }
  };
  return Parser;
}());
function isValidPugId(id){
  id = id ? id.trim() : '';
  return id && validPugIdRe.test(id);
}
function isValidPugClassName(className){
  className = className ? className.trim() : '';
  return className && validPugClassRe.test(className);
}
Writer = (function(){
  Writer.displayName = 'Writer';
  var prototype = Writer.prototype, constructor = Writer;
  function Writer(options){
    var ref$;
    this.options = options != null
      ? options
      : {};
    this.wrapLength = (ref$ = this.options.wrapLength) != null ? ref$ : 80;
    this.scalate = (ref$ = this.options.scalate) != null ? ref$ : false;
    this.attrSeparator = this.scalate || !this.options.attrComma ? ' ' : ', ';
    if (this.options.double) {
      this.attrQuote = '"';
      this.nonAttrQuote = "'";
    } else {
      this.attrQuote = "'";
      this.nonAttrQuote = '"';
    }
    this.attrQuoteEscaped = "\\" + this.attrQuote;
    this.noEmptyPipe = (ref$ = !options.emptyPipe) != null ? ref$ : false;
  }
  Writer.prototype.tagHead = function(node){
    var result, validClassNames;
    result = (function(){
      switch (false) {
      case node.tagName === 'DIV':
        return node.tagName.toLowerCase();
      default:
        return '';
      }
    }());
    if (node.id && isValidPugId(node.id)) {
      result += "#" + node.id;
    }
    if (node.hasAttribute('class') && node.getAttribute('class').length > 0) {
      validClassNames = node.getAttribute('class').split(/\s+/).filter(function(item){
        return item && isValidPugClassName(item);
      });
      result += "." + validClassNames.join('.');
    }
    if (result.length === 0) {
      result = 'div';
    }
    return result;
  };
  Writer.prototype.tagAttribute = function(node, indents){
    var attrs, results, i$, len$, attr, attrName, attrValue, invalidClassNames;
    indents == null && (indents = '');
    attrs = node.attributes;
    if (!attrs || attrs.length === 0) {
      return '';
    } else {
      results = [];
      for (i$ = 0, len$ = attrs.length; i$ < len$; ++i$) {
        attr = attrs[i$];
        attrName = attr.nodeName;
        attrValue = attr.nodeValue;
        if (attrName === 'id' && isValidPugId(attrValue)) {
          debug(' should already be emitted as #id, ignore');
        } else if (attrName === 'class') {
          invalidClassNames = node.getAttribute('class').split(/\s+/).filter(fn$);
          if (invalidClassNames.length > 0) {
            results.push(this.buildTagAttr(attrName, invalidClassNames.join(' ')));
          }
        } else {
          attrValue = attrValue.replace(/(\r|\n)\s/g, "\\$1" + indents);
          results.push(this.buildTagAttr(attrName, attrValue));
        }
      }
      if (results.length > 0) {
        return "(" + results.join(this.attrSeparator) + ")";
      } else {
        return '';
      }
    }
    function fn$(item){
      return item && !isValidPugClassName;
    }
  };
  Writer.prototype.buildTagAttr = function(attrName, attrValue){
    if (attrValue.indexOf(this.attrQuote) === -1) {
      return attrName + "=" + this.attrQuote + attrValue + this.attrQuote;
    } else if (attrValue.indexOf(this.nonAttrQuote) === -1) {
      return attrName + "=" + this.nonAttrQuote + attrValue + this.nonAttrQuote;
    } else {
      attrValue = attrValue.replace(new RegExp(this.attrQuote, 'g'), this.attrQuoteEscaped);
      return attrName + "=" + this.attrQuote + attrValue + this.attrQuote;
    }
  };
  Writer.prototype.tagText = function(node){
    var ref$, data;
    if (((ref$ = node.firstChild) != null ? ref$.nodeType : void 8) !== 3) {
      return null;
    } else if (node.firstChild !== node.lastChild) {
      return null;
    } else {
      data = node.firstChild.data;
      if (data.length > this.wrapLength || data.match(/\r|\n/)) {
        return null;
      } else {
        return data;
      }
    }
  };
  Writer.prototype.forEachChild = function(parent, callback){
    var child;
    if (parent) {
      child = parent.firstChild;
      while (child) {
        callback(child);
        child = child.nextSibling;
      }
    }
  };
  Writer.prototype.writeTextContent = function(node, output, options){
    var this$ = this;
    output.enter();
    this.forEachChild(node, function(child){
      this$.writeText(child, output, options);
    });
    output.leave();
  };
  Writer.prototype.writeText = function(node, output, options){
    var data, lines, this$ = this;
    if (node.nodeType === 3) {
      data = node.data || '';
      if (data.length > 0) {
        lines = data.split(/\r|\n/);
        lines.forEach(function(line){
          this$.writeTextLine(node, line, output, options);
        });
      }
    }
  };
  Writer.prototype.writeTextLine = function(node, line, output, options){
    var pipe, ref$, trim, wrap, encodeEntityRef, escapeBackSlash, prefix, ref1$, lines, this$ = this;
    options == null && (options = {});
    pipe = (ref$ = options.pipe) != null ? ref$ : true;
    trim = (ref$ = options.trim) != null ? ref$ : false;
    wrap = (ref$ = options.wrap) != null ? ref$ : true;
    encodeEntityRef = (ref$ = options.encodeEntityRef) != null ? ref$ : false;
    escapeBackSlash = (ref$ = options.escapeBackSlash) != null ? ref$ : false;
    if (pipe && this.noEmptyPipe && line.trim().length === 0) {
      return;
    }
    prefix = (function(){
      switch (false) {
      case !pipe:
        return '| ';
      default:
        return '';
      }
    }());
    debug('node: %o', node);
    debug('node.previous-sibling: %o', node.previousSibling);
    debug('node.next-sibling    : %o', node.nextSibling);
    if ((node != null ? (ref$ = node.previousSibling) != null ? ref$.nodeType : void 8 : void 8) !== 1) {
      line = line.trimLeft();
    }
    if ((node != null ? (ref1$ = node.nextSibling) != null ? ref1$.nodeType : void 8 : void 8) !== 1) {
      line = line.trimRight();
    }
    if (line) {
      if (encodeEntityRef) {
        line = Ent.encode(line, entOptions);
      }
      if (escapeBackSlash) {
        line = line.replace('\\', '\\\\');
      }
      if (!wrap || line.length <= this.wrapLength) {
        output.writeln(prefix + "" + line);
      } else {
        lines = this.breakLine(line);
        if (lines.length === 1) {
          output.writeln(prefix + "" + line);
        } else {
          lines.forEach(function(line){
            this$.writeTextLine(node, line, output, options);
          });
        }
      }
    }
  };
  Writer.prototype.breakLine = function(line){
    var lines, words, word;
    if (!line || line.length === 0) {
      return [];
    }
    if (line.search(/\s+/.exec(-1))) {
      return [line];
    }
    lines = [];
    words = line.split(/\s+/);
    line = '';
    while (words.length) {
      word = words.shift();
      if (line.length + word.length > this.wrapLength) {
        lines.push(line);
        line = word;
      } else if (line.length) {
        line += " " + word;
      } else {
        line = word;
      }
    }
    if (line.length) {
      lines.push(line);
    }
    return lines;
  };
  return Writer;
}());
publicIdDoctypeNames = {
  '-//W3C//DTD XHTML 1.0 Transition//EN': 'transitional',
  '-//W3C//DTD XHTML 1.0 Strict//EN': 'strict',
  '-//W3C//DTD XHTML 1.0 Frameset//EN': 'frameset',
  '-//W3C//DTD XHTML 1.1//EN': '1.1',
  '-//W3C//DTD XHTML Basic 1.1//EN': 'basic',
  '-//WAPFORUM//DTD XHTML Mobile 1.2//EN': 'mobile'
};
systemIdDoctypeNames = {
  'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd': 'transitional',
  'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd': 'strict',
  'http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd': 'frameset',
  'http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd': '1.1',
  'http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd': 'basic',
  'http://www.openmobilealliance.org/TR/tech/DTD/xhtml-mobile12.dtd': 'mobile'
};
Converter = (function(){
  Converter.displayName = 'Converter';
  var prototype = Converter.prototype, constructor = Converter;
  function Converter(options){
    var ref$;
    this.options = options != null
      ? options
      : {};
    this.scalate = (ref$ = this.options.scalate) != null ? ref$ : false;
    this.writer = (ref$ = this.options.writer) != null
      ? ref$
      : new Writer(this.options);
  }
  Converter.prototype.writeDocument = function(document, output){
    var doctype, docTypeName, publicId, systemId, htmlElements;
    if (document.doctype != null) {
      doctype = document.doctype;
      docTypeName = undefined;
      publicId = doctype.publicId;
      systemId = doctype.systemId;
      if (publicId != null && publicIdDoctypeNames[publicId] != null) {
        docTypeName = publicIdDoctypeNames[publicId];
      } else if (systemId != null && systemIdDoctypeNames[systemId] != null) {
        docTypeName = systemIdDoctypeNames[systemId] != null;
      } else if (doctype.name != null && doctype.name.toLowerCase() === 'html') {
        docTypeName = 'html';
      }
      if (docTypeName != null) {
        output.writeln("doctype " + docTypeName);
      }
    }
    if (document.documentElement) {
      this.writeChildren(document, output, false);
    } else {
      htmlElements = document.getElementByTagName('html');
      if (htmlElements.length > 0) {
        this.writeElement(htmlElements[0], output);
      }
    }
  };
  Converter.prototype.writeElement = function(node, output){
    var tagName, tagHead, tagAttr, tagText, firstLine;
    if (!(node != null && node.tagName)) {
      return;
    }
    tagName = node.tagName.toLowerCase();
    tagHead = this.writer.tagHead(node);
    tagAttr = this.writer.tagAttribute(node, output.indents);
    tagText = this.writer.tagText(node);
    if (tagName === 'script' || tagName === 'style') {
      if (node.hasAttribute('src')) {
        output.writeln(tagHead + "" + tagAttr);
        this.writer.writeTextContent(node, output, {
          pipe: false,
          wrap: false
        });
      } else {
        switch (tagName) {
        case 'script':
          this.writeScript(node, output, tagHead, tagAttr);
          break;
        case 'style':
          this.writeStyle(node, output, tagHead, tagAttr);
        }
      }
    } else if (tagName === 'conditional') {
      output.writeln("//" + node.getAttribute('condition'));
      this.writeChildren(node, output);
    } else if (['pre'].indexOf(tagName) !== -1) {
      output.writeln(tagHead + "" + tagAttr + ".");
      output.enter();
      firstLine = true;
      this.writer.forEachChild(node, function(child){
        var data, firstLine;
        if (child.nodeType === 3) {
          data = child.data;
          if (data != null && data.length > 0) {
            if (firstLine) {
              if (data.search(/\r\n|\r|\n/) === 0) {
                data = data.replace(/\r\n|\r|\n/, '');
              }
              data = "\\n" + data;
              firstLine = false;
            }
            data = data.replace(/\t/g, '\\t');
            data = data.replace(/\r\n|\r|\n/g, "\n" + output.indents);
            output.write(data);
          }
        }
      });
      output.writeln();
      output.leave;
    } else if (this.options.bodyLess && (tagName === 'html' || tagName === 'head' || tagName === 'body')) {
      this.writeChildren(node, output, false);
    } else if (tagText) {
      if (doNotEncode) {
        output.writeln(tagHead + "" + tagAttr + " " + tagText);
      } else {
        output.writeln(tagHead + "" + tagAttr + " " + Ent.encode(tagText, entOptions));
      }
    } else {
      output.writeln(tagHead + "" + tagAttr);
      this.writeChildren(node, output);
    }
  };
  Converter.prototype.writeChildren = function(parent, output, indent){
    var this$ = this;
    indent == null && (indent = true);
    if (indent) {
      output.enter();
    }
    this.writer.forEachChild(parent, function(child){
      var nodeType;
      nodeType = child.nodeType;
      switch (nodeType) {
      case 1:
        return this$.writeElement(child, output);
      case 3:
        switch (parent._nodeName) {
        case 'code':
          return this$.writeText(child, output, {
            encodeEntityRef: true,
            pipe: true
          });
        default:
          return this$.writeText(child, output, {
            encodeEntityRef: doNotEncode ? false : true
          });
        }
        break;
      case 8:
        return this$.writeComment(child, output);
      }
    });
    if (indent) {
      output.leave();
    }
  };
  Converter.prototype.writeText = function(node, output, options){
    node.normalize();
    this.writer.writeText(node, output, options);
  };
  Converter.prototype.writeComment = function(node, output){
    var condition, data, lines, this$ = this;
    condition = node.data.match(/\s*\[(if\s+[^\]]+)\]/);
    if (!condition) {
      data = node.data || '';
      if (data.length === 0 || data.search(/\r|\n/) === -1) {
        output.writeln("// " + data.trim());
      } else {
        output.writeln('//');
        output.enter();
        lines = data.split(/\r|\n/);
        lines.forEach(function(line){
          return this$.writer.writeTextLine(node, line, output, {
            pipe: false,
            trim: true,
            wrap: false
          });
        });
        output.leave();
      }
    } else {
      this.writeConditional(node, condition[1], output);
    }
  };
  Converter.prototype.writeConditional = function(node, condition, output){
    var innerHTML, conditionalElem;
    innerHTML = node.textContent.trim().replace(/\s*\[if\s+[^\]]+\]>\s*/, '').replace('<![endif]', '');
    if (innerHTML.indexOf('<!') === 0) {
      condition = "[" + condition + "] <!";
      innerHTML = null;
    }
    conditionalElem = node.ownerDocument.createElement('conditional');
    conditionalElem.setAttribute('condition', condition);
    if (innerHTML) {
      conditionalElem.innerHTML = innerHTML;
    }
    node.parentNode.insertBefore(conditionalElem, node.nextSibling);
  };
  Converter.prototype.writeScript = function(node, output, tagHead, tagAttr){
    if (this.scalate) {
      output.writeln(':javascript');
      this.writer.writeTextContent(node, output, {
        pipe: false,
        wrap: false
      });
    } else {
      output.writeln(tagHead + "" + tagAttr);
      this.writer.writeTextContent(node, output, {
        pipe: false,
        trim: true,
        wrap: false,
        escapeBackSlash: true
      });
    }
  };
  Converter.prototype.writeStyle = function(node, output, tagHead, tagAttr){
    if (this.scalate) {
      output.writeln(':css');
      this.writer.writeTextContent(node, output, {
        pipe: false,
        wrap: false
      });
    } else {
      output.writeln('#{tag-head}#{tag-attr}');
      this.writer.writeTextContent(node, output, {
        pipe: false,
        trim: true,
        wrap: false
      });
    }
  };
  return Converter;
}());
Output = (function(){
  Output.displayName = 'Output';
  var prototype = Output.prototype, constructor = Output;
  function Output(indents){
    this.indents = indents != null ? indents : '';
  }
  Output.prototype.enter = function(){
    if (useTabs) {
      this.indents += '\t';
    } else {
      this.indents += repeatString$(' ', tabWidth);
    }
  };
  Output.prototype.write = function(data, indent){
    indent == null && (indent = true);
  };
  Output.prototype.writeln = function(data, indent){
    indent == null && (indent = true);
  };
  Output.prototype.leave = function(){
    if (useTabs) {
      this.indents = this.indents.substring(1);
    } else {
      this.indents = this.indents.substring(tabWidth);
    }
  };
  return Output;
}());
StringOutput = (function(superclass){
  var prototype = extend$((import$(StringOutput, superclass).displayName = 'StringOutput', StringOutput), superclass).prototype, constructor = StringOutput;
  function StringOutput(){
    StringOutput.superclass.call(this);
    this.fragments = [];
  }
  StringOutput.prototype.write = function(data, indent){
    indent == null && (indent = true);
    data == null && (data = '');
    if (indent) {
      this.gragments.push(this.indents + data);
    } else {
      this.gragments.push(data);
    }
  };
  StringOutput.prototype.writeln = function(data, indent){
    indent == null && (indent = true);
    data == null && (data = '');
    if (indent) {
      this.gragments.push(this.indents + data + '\n');
    } else {
      this.gragments.push(data + '\n');
    }
  };
  StringOutput.prototype.final = function(){
    var result;
    result = this.fragments.join('');
    this.fragments = [];
    return result;
  };
  return StringOutput;
}(Output));
StreamOutput = (function(superclass){
  var prototype = extend$((import$(StreamOutput, superclass).displayName = 'StreamOutput', StreamOutput), superclass).prototype, constructor = StreamOutput;
  function StreamOutput(stream){
    this.stream = stream;
    StreamOutput.superclass.call(this);
  }
  StreamOutput.prototype.write = function(data, indent){
    indent == null && (indent = true);
    data == null && (data = '');
    if (indent) {
      this.stream.write(this.indents + data);
    } else {
      this.stream.write(data);
    }
  };
  StreamOutput.prototype.writeln = function(data, indent){
    indent == null && (indent = true);
    data == null && (data = '');
    if (indent) {
      this.stream.write(this.indents + data + '\n');
    } else {
      this.stream.write(data + '\n');
    }
  };
  return StreamOutput;
}(Output));
out$.Output = Output;
out$.StringOutput = StringOutput;
out$.Converter = Converter;
out$.Writer = Writer;
function applyOptions(options){
  if (options.numeric != null) {
    entOptions.useNamedReferences = options.numeric;
  }
  if (options.tabWidth != null) {
    tabWidth = parseInt(options.tabWidth);
  }
  if (options.useTabs != null) {
    useTabs = options.useTabs;
  }
  if (options.doNotEncode != null) {
    doNotEncode = options.doNotEncode;
  }
}
out$.Parser = Parser;
out$.StreamOutput = StreamOutput;
out$.convert = convert;
function convert(input, output, options){
  options == null && (options = {});
  applyOptions(options);
  output == null && (output = new StreamOutput(process.stdout));
  options.parser == null && (options.parser = new Parser(options));
  options.parser.parse(input, function(errors, window){
    if (errors != null && errors.length) {
      debug(errors);
    } else {
      options.converter == null && (options.converter = new Converter(options));
      options.converter.writeDocument(window.document, output);
    }
  });
}
out$.convertHtml = convertHtml;
function convertHtml(html, options, callback){
  var output, ref$;
  options == null && (options = {});
  applyOptions(options);
  output = (ref$ = options.output) != null
    ? ref$
    : new StringOutput();
  options.parser == null && (options.parser = new Parser(options));
  options.parser.parse(input, function(errors, window){
    if (errors != null && errors.length) {
      debug(errors);
    } else {
      options.converter = new Converter(options);
      options.converter.writeDocument(window.document, output);
      if (callback != null) {
        callback(null, output.final());
      }
    }
  });
}
out$.convertDocument = convertDocument;
function convertDocument(document, options, callback){
  var output, ref$;
  options == null && (options = {});
  applyOptions(options);
  output = (ref$ = options.output) != null
    ? ref$
    : new StringOutput();
  options.converter == null && (options.converter = new Converter(options));
  options.converter.writeDocument(document, output);
  if (callback != null) {
    callback(null, output.final());
  }
}
function repeatString$(str, n){
  for (var r = ''; n > 0; (n >>= 1) && (str += str)) if (n & 1) r += str;
  return r;
}
function extend$(sub, sup){
  function fun(){} fun.prototype = (sub.superclass = sup).prototype;
  (sub.prototype = new fun).constructor = sub;
  if (typeof sup.extended == 'function') sup.extended(sub);
  return sub;
}
function import$(obj, src){
  var own = {}.hasOwnProperty;
  for (var key in src) if (own.call(src, key)) obj[key] = src[key];
  return obj;
}