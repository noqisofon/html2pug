#!/usr/bin/env node
const fs   = require( 'fs' );
const path = require( 'path' );
const url  = require( 'url' );

const metaDebug = require( 'debug' );

const html2pug  = require( './lib/html2pug' );

const debug = metaDebug( 'cli' );

function parsePath(where) {
    if ( typeof where !== 'string' ) {
        console.error( `invalid init: ${where}` );
    } else if ( path.resolve( '/', where ) === where ) {
        return where;
    } else if ( where.length >= 2 && where.substring( 0, 1 ) === '~/' ) {
        return path.join( process.env.HOME, where.substring( 2 ) );
    } else {
        return path.join( process.cwd(), where );
    }
    return null;
}

function convert(input, output, options) {
    // debug( 'convert ( %o, %o, %o )', input, output, options );

    if ( input ) {
        let errors;
        try {
            errors = html2pug.convert( input, output, options );
            
        } catch ( err ) {
            debug( err );
        }

        if ( errors ) {
            console.error( `parser errors: ${errors}` );
        }
    } else {
        console.error( `invalid input: ${input}` );
    }
}

const commander   = require( 'commander' );
const packageJson = require( './package.json' );

commander
    .version( packageJson.version )
    .option( '-d, --double'       , 'use double quotes for attributes' )
    .option( '-s, --scalate'      , 'generate pug syntax compatible with Scalate' )
    .option( '-t, --tabs'         , 'use tabs instead of spaces' )
    .option( '-o, --outdir <dir>' , 'path to output generated pug file(s) to', parsePath )
    .option( '-n, --tab-width <n>', 'the number of spaces to indent generated files with', parseInt )
    .option( '--do-not-encode'    , 'do not html encode characters (useful for templates)' )
    .option( '--body-less'        , 'do not output enveloping html and body tags' )
    .option( '--numeric'          , 'use numeric character entities' )
    .option( '--no-attr-comma'    , 'omit attribute separating commas' )
    .option( '--no-empty-pipe'    , 'omit lines with only pipe (\'|\') printable character' );

commander.parse( process.argv );

if ( commander.outdir && !fs.existsSync( commander.outdir ) ) {
    console.error( `output directory '${commander.outdir}' doesn't exist` );
    process.exit( 1 );
}

let args = commander.args;
if ( !args || args.length === 0 ) {
    args = [ '-' ];
}

// debug( 'commander: %o', commander );
// debug( 'commander.attr-comma: %o', commander.attrComma );
// debug( 'commander.empty-pipe: %o', commander.emptyPipe );
// debug( 'args     : %o', args );


for ( let i in args ) {
    let arg = args[i];

    // debug( '%d - %o', i, arg );
    if ( arg === '-' ) {
        input = '';

        process.stdin.resume();
        process.stdin.on( 'data', (chunk) => input += chunk );
        process.stdin.on( 'end' , ()      => {
            commander.inputType = 'html';

            return convert( input, undefined, commander );
        } );
        
        continue;
    }

    let inputUrl;
    if ( typeof arg === 'string' && !fs.existsSync( arg ) ) {
        try {
            inputUrl = url.parse( arg );
        } catch ( err ) {
            debug( 'invalid url: %s', arg );
        }
    }

    // debug( 'input-url: %o', inputUrl );

    if ( inputUrl && inputUrl.protocol ) {
        commander.inputType = 'url';
        convert( arg, undefined, commander );
    } else {
        let inputPath = parsePath( arg );

        // debug( 'input-path: %o', inputPath );

        if ( fs.existsSync( inputPath ) ) {
            inputStats = fs.statSync( inputPath );

            // debug( 'input-stats: %o', inputStats );

            if ( inputStats.isFile() ) {
                let outdir     = commander.outdir || path.dirname( arg );
                let outputPath = path.join( outdir, `${path.basename( inputPath, path.extname( inputPath ) )}.pug` );

                // debug( `outdir     : ${outdir}` );
                // debug( `output-path: ${outputPath}` );

                let outputStream = fs.createWriteStream( outputPath, { flags: 'w', encoding: 'utf8' } );

                commander.inputType = 'file';

                convert( inputPath, new html2pug.StreamOutput( outputStream ), commander );
            }
        } else {
            console.error( `input file doesn't exist: ${arg}` );
        }
    }
}
