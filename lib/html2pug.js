var fs, path, jsdomLittle, Ent, metaDebug, debug, entOptions, tabWidth, useTabs, doNotEncode, validPugIdRe, validPugClassRe, Parser, Writer, publicIdDoctypeNames, systemIdDoctypeNames, Converter, Output, StringOutput, StreamOutput, applyOptions, convert, convertHtml, convertDocument, out$ = typeof exports != 'undefined' && exports || this;
fs = require('fs');
path = require('path');
jsdomLittle = require('jsdom-little');
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
    var reader;
    debug('Parser#parse( %j, %j )', filename, callback);
    if (!filename) {
      return callback('null file');
    } else {
      if (this.options.inputType === 'file') {
        reader = fs.readFileSync(filename, 'utf-8');
      }
      return jsdomLittle.env(reader, callback);
    }
  };
  return Parser;
}());
function isValidPugId(id){
  id = id ? id.trim() : "";
  return id && validPugIdRe.test(id);
}
function isValidPugClassName(className){
  className = className ? className.trim() : "";
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
    this.attrSparator = this.scalate || this.options.noAttrComma ? ' ' : ', ';
    if (this.options.double) {
      this.attrQuote = '"';
      this.nonAttrQuote = '"';
    } else {
      this.attrQuote = "'";
      this.nonAttrQuote = "'";
    }
    this.attrQuoteEscaped = "\\" + this.attrQuote;
  }
  Writer.prototype.tagHead = function(node){
    var result, validClassNames;
    result = node.tagName !== 'DIV' ? node.tagName.toLowerCase() : '';
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
          null;
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
    if (attrValue.indexOf(this.attrQuote === -1)) {
      return attrName + "=" + this.attrQuote + attrValue + this.attrQuote;
    } else if (attrValue.indexOf(this.nonAttrQuote) === -1) {
      return attrName + "=" + this.nonAttrQuote + attrValue + this.nonAttrQuote;
    } else {
      attrValue = attrValue.replace(new RegExp(this.attrQuote, 'g'), this.attrQuoteEscaped);
      return attrName + "=" + this.attrQuote + attrValue + attrQuote;
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
    var child, results$ = [];
    if (parent) {
      child = parent.firstChild;
      while (child) {
        callback(child);
        results$.push(child = child.nextSibling);
      }
      return results$;
    }
  };
  Writer.prototype.writeTextContent = function(node, output, options){
    var self;
    output.enter();
    self = this;
    this.forEachChild(node, function(child){
      return self.writeText(child, output, options);
    });
    return output.leave();
  };
  Writer.prototype.writeText = function(node, output, options){
    var data, lines, self;
    debug('Writer#write-text( %j, %j, %j )', node, output, options);
    debug('node.node-type: %d', node.nodeType);
    debug('node.data: %j', node.data);
    if (node.nodeType === 3) {
      data = node.data || '';
      if (data.length > 0) {
        lines = data.split(/\r|\n/);
        self = this;
        lines.forEach(function(line){
          self.writeTextLine(node, line, output, options);
        });
      }
    }
  };
  Writer.prototype.writeTextLine = function(node, line, output, options){
    var pipe, ref$, trim, wrap, encodeEntityRef, escapeBackSlash, prefix, ref1$, lines;
    options == null && (options = {});
    debug('Writer#write-text-line( %j, %j, %j, %j )', node, line, output, options);
    pipe = (ref$ = options.pipe) != null ? ref$ : true;
    trim = (ref$ = options.trim) != null ? ref$ : false;
    wrap = (ref$ = options.wrap) != null ? ref$ : true;
    debug('pipe: %j, trim: %j, wrap: %j', pipe, trim, wrap);
    encodeEntityRef = (ref$ = options.encodeEntityRef) != null ? ref$ : false;
    escapeBackSlash = (ref$ = options.escapeBackSlash) != null ? ref$ : false;
    debug('encode-entity-ref: %j, escape-back-slash: %j', encodeEntityRef, escapeBackSlash);
    if (pipe && this.noEmptyPipe && line.trim().length === 0) {
      return;
    }
    prefix = pipe ? '| ' : '';
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
      debug("'" + prefix + line + "'");
      if (!wrap || line.length <= this.wrapLength) {
        output.writeln(prefix + "" + line);
      } else {
        lines = this.breakLine(line);
        if (lines.length === 1) {
          output.writeln(prefix + "" + line);
        } else {
          lines.forEach(function(line){
            this.writeTextLine(node, line, output, options);
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
    debug('Converter#write-document(%j, %j)', document, output);
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
      this.writeChild(document, output, false);
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
      } else if (tagName === 'script') {
        this.writeScript(node, output, tagHead, tagAttr);
      } else if (tagName === 'style') {
        this.writeScript(node, output, tagHead, tagAttr);
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
              if (data.search(/\r\n|\r|\n/.exec(0))) {
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
    } else if (this.options.bodyless && (tagName === 'html' || tagName === 'body')) {
      this.writeChild(node, output, false);
    } else if (tagText) {
      if (doNotEncode) {
        output.writeln(tagHead + "" + tagAttr + " " + tagText);
      } else {
        output.writeln(tagHead + "" + tagAttr + " " + Ent.encode(tagText, entOptions));
      }
    } else {
      output.writeln(tagHead + "" + tagAttr);
      this.writeChild(node, output);
    }
  };
  Converter.prototype.writeChild = function(parent, output, indent){
    var self;
    indent == null && (indent = true);
    if (indent) {
      output.enter();
    }
    self = this;
    this.writer.forEachChild(parent, function(child){
      var nodeType;
      nodeType = child.nodeType;
      if (nodeType === 1) {
        return self.writeElement(child, output);
      } else if (nodeType === 3) {
        if (parent._nodeName === 'code') {
          return self.writeText(child, output, {
            encodeEntityRef: true,
            pipe: true
          });
        } else {
          return self.writeText(child, output, {
            encodeEntityRef: doNotEncode ? true : true
          });
        }
      } else if (nodeType === 8) {
        return self.writeComment(child, output);
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
    var condition, data, lines;
    condition = node.data.match(/\s*\[(if\s+[^\]]]+)\]/);
    if (!condition) {
      data = node.data || '';
      if (data.length === 0 || data.search(/\r|\n/) === -1) {
        output.writeln("// " + data.trim());
      } else {
        output.writeln('//');
        output.enter();
        lines = data.split(/\r|\n/);
        lines.forEach(function(line){
          return this.write.writeTextLine(node, line, output, {
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
    innerHTML = node.textContent.trim().raplace(/\s\[if\s+[^\]]+\]>\s*/, '').replace('<![endif]', '');
    if (innerHTML.indexOf('<!' === 0)) {
      condition = "[" + condition + "] <!";
      innerHTML = null;
    }
    conditionalElem = node.ownDocument.createElement('conditional');
    conditionalElem.setAttribute('condition', condition);
    conditionalElem.insertBefore(conditionalElem, node.nextSibling);
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
    debug('Output#enter');
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
    debug('Output#leave');
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
applyOptions = function(options){
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
  debug('tab-width:     %j', tabWidth);
  debug('use-tabs:      %j', useTabs);
  debug('do-not-encode: %j', doNotEncode);
};
out$.Parser = Parser;
out$.StreamOutput = StreamOutput;
out$.convert = convert = function(input, output, options){
  options == null && (options = {});
  debug('convert( %j, %j, %j )', input, output, options);
  applyOptions(options);
  options.parser == null && (options.parser = new Parser(options));
  options.parser.parse(input, function(errors, window){
    debug('parse callback ( %j, %j )', errors, window);
    if (errors != null && errors.length) {
      errors;
    } else {
      options.converter == null && (options.converter = new Converter(options));
      options.converter.writeDocument(window.document, output);
    }
  });
};
out$.convertHtml = convertHtml = function(html, options, callback){
  options == null && (options = {});
  applyOptions(options);
  options.parser == null && (options.parser = new Parser(options));
  options.parser.parse(input, function(errors, window){
    var output, ref$;
    if (errors != null && errors.length) {
      errors;
    } else {
      output = (ref$ = options.output) != null
        ? ref$
        : new StringOutput();
      options.converter = new Converter(options);
      options.converter.writeDocument(window.document, output);
      if (callback != null) {
        callback(null, output.final());
      }
    }
  });
};
out$.convertDocument = convertDocument = function(document, options, callback){
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
};
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