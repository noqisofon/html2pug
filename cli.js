var fs, path, url, metaDebug, html2pug, debug, parsePath, convert, commander, packageJson, args, i, arg, input, inputUrl, e, inputPath, inputStats, outdir, outputPath, outputStream;
fs = require('fs');
path = require('path');
url = require('url');
metaDebug = require('debug');
html2pug = require('./lib/html2pug');
debug = metaDebug('cli');
parsePath = function(arg){
  if (typeof arg !== 'string') {
    console.error("invalid input: " + arg);
  } else if (path.resolve('/', arg) === arg) {
    return arg;
  } else if (arg.length >= 2 && arg.substring(0, 2) === '~/') {
    return path.join(process.env.HOME, arg.substring(2));
  } else {
    return path.join(process.cwd(), arg);
  }
  return null;
};
convert = function(input, output, options){
  var errors, e;
  debug('convert(%j, %j, %j)', input, output, options);
  if (input) {
    try {
      errors = html2pug.convert(input, output, options);
      if (errors) {
        console.error("parser errors: " + errors);
      }
    } catch (e$) {
      e = e$;
      console.error(e);
    }
  } else {
    console.error("invalid input: " + input);
  }
};
commander = require('commander');
packageJson = require('./package.json');
commander.version(packageJson.version).option('-d, --double', 'use double quotes for attributes').option('-s, --scalate', 'generate pug syntax compatible with Scalate').option('-t, --tabs', 'use tabs instead of spaces').option('-o, --outdir <dir>', 'path to output generated pug file(s) to', parsePath).option('-n, --tab-width <n>', 'the number of spaces to indent generated files with', parseInt).option('--do-not-encode', 'do not html encode characters (useful for templates)').option('--body-less', 'do not output enveloping html and body tags').option('--numeric', 'use numeric character entities').option('--no-attr-comma', 'omit attribute separating commas').option('--no-enpty-pipe', 'omit lines with only pipe (\'|\') printable character');
commander.parse(process.argv);
if (commander.outdir && !fs.existsSync(commander.outdir)) {
  console.error("output directory '" + commander.outdir + "' doesn't exist");
  process.exit(1);
}
args = commander.args;
if (!args || args.length === 0) {
  args = ['-'];
}
debug('args: %j', args);
for (i in args) {
  arg = args[i];
  debug('%d - %j', i, arg);
  if (arg === '-') {
    input = '';
    process.stdin.resume();
    process.stdin.on('data', fn$);
    process.stdin.on('end', fn1$);
    continue;
  }
  if (typeof arg === 'string' && !fs.existsSync(arg)) {
    try {
      inputUrl = url.parse(arg);
    } catch (e$) {
      e = e$;
    }
  }
  debug('input-url: %j', inputUrl);
  if (inputUrl && inputUrl.protocol) {
    commander.inputType = 'url';
    convert(arg, undefined, commander);
  } else {
    inputPath = parsePath(arg);
    debug('input-path: %j', inputPath);
    if (fs.existsSync(inputPath)) {
      inputStats = fs.statSync(inputPath);
      debug('input-stats: %j', inputStats);
      if (inputStats.isFile()) {
        outdir = commander.outdir || path.dirname(arg);
        outputPath = path.join(outdir, path.basename(inputPath, path.extname(inputPath)) + '.pug');
        debug('outdir: %j, output-path: %j', outdir, outputPath);
        outputStream = fs.createWriteStream(outputPath, {
          flags: 'w',
          encoding: 'utf8'
        });
        commander.inputType = 'file';
        convert(inputPath, new html2pug.StreamOutput(outputStream), commander);
      }
    } else {
      console.error("input file doesn't exist: " + arg);
    }
  }
}
function fn$(chunk){
  return input += chunk;
}
function fn1$(){
  commander.inputType = 'html';
  return convert(input, undefined, commander);
}