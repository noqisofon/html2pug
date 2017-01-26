var assert, fs, path, exec, async, html2pug, testFile;
assert = require('assert');
fs = require('fs');
path = require('path');
exec = require('child_process').exec;
async = require('async');
html2pug = function(inputFile, outputDir, callback){
  var command, options, child;
  command = "node ../cli.js --no-empty-pipe " + inputFile + " -o " + outputDir;
  options = {
    cwd: __dirname
  };
  return child = exec(command, options, function(err, stdout, stderr){
    if (callback) {
      return callback(err);
    }
  });
};
testFile = function(inputFile, expectedFile, outputDir, fileDone){
  var basename, outputFile;
  basename = path.basename(inputFile, path.extname(inputFile));
  outputFile = path.join(outputDir, basename + ".pug");
  html2pug(inputFile, outputDir, function(err){
    var actual, expected;
    if (!err) {
      actual = fs.readFileSync(outputFile, 'utf8');
      expected = fs.readFileSync(expectedFile, 'utf8');
      assert.equal(actual, expected);
    }
    fileDone(err);
  });
};
describe('html2pug', function(){
  var testDir;
  testDir = function(inputDir, expectedDir, outputDir){
    var inputFiles;
    inputDir = path.resolve(__dirname, inputDir);
    expectedDir = path.resolve(__dirname, expectedDir);
    outputDir = path.resolve(__dirname, outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    inputFiles = fs.readdirSync(inputDir);
    return inputFiles.forEach(function(inputFile){
      var extname, basename, expectedFile;
      extname = path.extname(inputFile).toLowerCase();
      basename = path.basename(inputFile, path.extname(inputFile));
      if (extname === '.html' || extname === '.htm') {
        inputFile = path.join(inputDir, inputFile);
        expectedFile = path.join(expectedDir, basename + ".pug");
        it("should convert " + path.basename(inputFile) + " to output matching " + path.basename(expectedFile), function(done){
          testFile(inputFile, expectedFile, outputDir, done);
        });
      }
    });
  };
  return testDir('./data/', './data/', '../temp/');
});