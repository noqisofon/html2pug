require! <[ assert fs path ]>
require! child_process: {exec}
require! \async

html2pug = (input-file, output-dir, callback) ->
  command = "node ../cli.js -d #{input-file} -o #{output-dir}"
  options =
    cwd: __dirname
  child = exec command, options, (err, stdout, stderr) ->
    callback err if callback

test-file = (input-file, expected-file, output-dir, file-done) !->
  basename    = path.basename input-file, path.extname( input-file )
  output-file = path.join output-dir, "#{basename}.pug"

  html2pug input-file, output-dir, (err) !->
    unless err
      actual   = fs.read-file-sync output-file, \utf8
      expected = fs.read-file-sync expected-file, \utf8
      assert.equal actual, expected
    file-done err

describe 'html2pug', ->

  test-dir = (input-dir, expected-dir, output-dir) ->
    input-dir    = path.resolve __dirname, input-dir
    expected-dir = path.resolve __dirname, expected-dir
    output-dir   = path.resolve __dirname, output-dir 

    fs.mkdir-sync output-dir unless fs.exists-sync output-dir

    input-files = fs.readdir-sync input-dir
    input-files.for-each (input-file) !->
      extname  = path.extname input-file .to-lower-case!
      basename = path.basename input-file, path.extname( input-file )

      if extname is '.html' or extname is '.htm'
        input-file    = path.join input-dir, input-file
        expected-file = path.join expected-dir, "#{basename}.pug"

        it "should convert #{path.basename( input-file )} to output matching #{path.basename( expected-file )}", (done) !->
          test-file input-file, expected-file, output-dir, done

  test-dir './data/', './data/', '../temp/'
