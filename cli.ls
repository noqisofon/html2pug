require! <[ fs path url ]>
require! debug: meta-debug
require! './lib/html2pug'

debug = meta-debug \cli

parse-path = (arg) ->
  if typeof arg isnt \string
    console.error "invalid input: #{arg}"
  else if path.resolve( '/', arg ) is arg
    return arg
  else if arg.length >= 2 and arg.substring( 0, 2 ) is '~/'
    return path.join( process.env.HOME, arg.substring( 2 ) )
  else
    return path.join( process.cwd!, arg )
  return null

convert = (input, output, options) !->
  debug 'convert(%j, %j, %j)', input, output, options
  if input
    try
      errors = html2pug.convert input, output, options

      if errors
        console.error "parser errors: #{errors}"
    catch
      console.error e
  else
    console.error "invalid input: #{input}"

require! commander
require! './package.json': packageJson

commander
  .version packageJson.version
  .option '-d, --double'       , 'use double quotes for attributes'
  .option '-s, --scalate'      , 'generate pug syntax compatible with Scalate'
  .option '-t, --tabs'         , 'use tabs instead of spaces'
  .option '-o, --outdir <dir>' , 'path to output generated pug file(s) to', parse-path
  .option '-n, --tab-width <n>', 'the number of spaces to indent generated files with', parse-int
  .option '--do-not-encode'    , 'do not html encode characters (useful for templates)'
  .option '--body-less'        , 'do not output enveloping html and body tags'
  .option '--numeric'          , 'use numeric character entities'
  .option '--no-attr-comma'    , 'omit attribute separating commas'
  .option '--no-enpty-pipe'    , 'omit lines with only pipe (\'|\') printable character'

commander.parse process.argv

if commander.outdir and not fs.exists-sync commander.outdir
  console.error "output directory '#{commander.outdir}' doesn't exist"
  process.exit 1

args = commander.args
if not args or args.length is 0
  args = [ '-' ]

debug 'args: %j', args

for i of args
  arg = args[i]

  debug '%d - %j', i, arg

  if arg is '-'
    input = ''
    process.stdin.resume!
    process.stdin.on \data, (chunk) ->
      input += chunk
    process.stdin.on \end, ->
      commander.input-type = \html
      convert input, undefined, commander
    continue

  if typeof arg is \string and not fs.exists-sync arg
    try
      input-url = url.parse arg
    catch

  debug 'input-url: %j', input-url
      
  if input-url and input-url.protocol
    commander.input-type = \url
    convert arg, undefined, commander
  else
    input-path = parse-path arg

    debug 'input-path: %j', input-path

    if fs.exists-sync input-path
      input-stats = fs.stat-sync input-path
      debug 'input-stats: %j', input-stats
      if input-stats.is-file!
        outdir      = commander.outdir or path.dirname( arg )
        output-path = path.join( outdir, path.basename( input-path, path.extname( input-path ) ) + '.pug' )

        debug 'outdir: %j, output-path: %j', outdir, output-path

        output-stream = fs.create-write-stream output-path,
          flags: \w
          encoding: \utf8
        commander.input-type = \file
        convert input-path, new html2pug.StreamOutput( output-stream ), commander
    else
      console.error "input file doesn't exist: #{arg}"

