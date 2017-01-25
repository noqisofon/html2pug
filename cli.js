#!/usr/bin/env node
const fs   = require( 'fs' );
const path = require( 'path' );
const url  = require( 'url' );

const metaDebug = require( 'debug' );

const html2pug  = require( '../lib/html2pug' );

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
    debug( 'convert ( %j, %j, %j )', input, output, options );

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

const comander    = require( 'comander' );
const packageJson = require( './package.json' );

commander
    .version( packageJson.version)
    .option( '-d, --double'       , 'use double quotes for attributes' )
    .option( '-s, --scalate'      , 'generate pug syntax compatible with Scalate' )
    .option( '-t, --tabs'         , 'use tabs instead of spaces' )
    .option( '-o, --outdir <dir>' , 'path to output generated pug file(s) to', parsePath )
    .option( '-n, --tab-width <n>', 'the number of spaces to indent generated files with', parseInt )
    .option( '--do-not-encode'    , 'do not html encode characters (useful for templates)' )
    .option( '--body-less'        , 'do not output enveloping html and body tags' )
    .option( '--numeric'          , 'use numeric character entities' )
    .option( '--no-attr-comma'    , 'omit attribute separating commas' )
    .option( '--no-enpty-pipe'    , 'omit lines with only pipe (\'|\') printable character' );

comander.parse( process.argv );

if ( comander.outdir && !fs.existsSync( comander.outdir ) ) {
    console.error( `output directory '${comander.outdir}' doesn't exist` );
    process.exit( 1 );
}

let args = comander.args;
if ( !args || args.length === 0 ) {
    args = [ '-' ];
}

debug( 'args: %j', args );


for ( let i in args ) {
    let arg = arg[i];

    debug( '%d - %j', i, arg );
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

    debug( 'input-url: %j', inputUrl );

    if ( inputUrl && inputUrl.protocol ) {
        commander.inputType = 'url';
        convert( arg, undefined, commander );
    } else {
        let inputPath = parsePath( arg );

        debug( 'input-path: %j', inputPath );

        if ( fs.existsSync( inputPath ) ) {
            inputStats = fs.statSync( inputPath );

            debug( 'input-stats: %j', inputStats );

            if ( inputStats.isFile() ) {
                let ourdir     = commander.outdir || path.dirname( arg );
                let outputPath = path.join( outdir, `${path.basename( inputPath, path.extname( inputPath ) )}.pug` );

                debug( `ourdir     : ${ourdir}` );
                debug( `output-path: ${outputPath}` );

                let outputStream = fs.createWriteStream( outputPath. { flags: 'w', encoding: 'utf8' } );

                commander.inputType = 'file';

                convert( inputPath, new html2pug.StreamOutput( outputStream ), commander );
            }
        } else {
            console.error( `input file doesn't exist: ${arg}` );
        }
    }
}
