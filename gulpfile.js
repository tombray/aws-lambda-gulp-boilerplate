var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var rename = require('gulp-rename');
var install = require('gulp-install');
var zip = require('gulp-zip');
var AWS = require('aws-sdk');
var fs = require('fs');
var runSequence = require('run-sequence');
var prompt = require('gulp-prompt');
var fs = require('fs'),
    path = require('path');

var handleError = function (msg) {
  gutil.log(gutil.colors.red('ERROR!', msg)) ;
  process.exit(1);
}

var argv = require('yargs')
.command('update', 'Updates an AWS Lambda, assuming it already exists.', function (yargs, argv) {
  argv = yargs.option('l', {
        alias: 'lambda',
        description: 'Name of the directory that contains your function. Must be a subdirectory of ./lambda and must match the AWS function name.',
        demand: true
      })
      .argv  
})
.argv;

var validateLambda = function () {
  var lambda = argv.lambda;

  if (lambda) {
    var lambdaPath = 'lambda/' + lambda;
    //check that directory exists
    try {
      fs.statSync(lambdaPath);  
    } catch(e) {
      handleError(lambdaPath + ' does not exist');
    }
  }  
}


/*
var lambdaName = argv.l;
var lambdaDir = "./lambda/" + lambdaName;
var DIST = lambdaDir + "/dist";
*/

// First we need to clean out the dist folder and remove the compiled zip file.
gulp.task('clean', function(done) {
  del(DIST).then(function(){
   done()
  });
});

gulp.task('js', function() {
  return gulp.src( lambdaDir + '/*.js')
    .pipe(gulp.dest(DIST));
});

// Here we want to install npm packages to dist, ignoring devDependencies.
gulp.task('npm', function() {
  return gulp.src( lambdaDir + '/package.json')
    .pipe(gulp.dest(DIST))
    .pipe(install({production: true}));
});

// Next copy over environment variables managed outside of source control.
gulp.task('env', function() {
  return gulp.src( lambdaDir + '/config.env.production')
    .pipe(rename('.env'))
    .pipe(gulp.dest(DIST));
});

// Now the dist directory is ready to go. Zip it.
gulp.task('zip', function() {
  return gulp.src([ DIST + '/**/*', '!' + DIST + '/package.json', DIST + '/.*'])
    .pipe(zip('dist.zip'))
    .pipe(gulp.dest(lambdaDir));
});

// Per the gulp guidelines, we do not need a plugin for something that can be
// done easily with an existing node module. #CodeOverConfig
//
// Note: This presumes that AWS.config already has credentials. This will be
// the case if you have installed and configured the AWS CLI.
//
// See http://aws.amazon.com/sdk-for-node-js/
gulp.task('xupload', function(done) {

  // TODO: This should probably pull from package.json
  AWS.config.region = 'us-west-2';
  var lambda = new AWS.Lambda({apiVersion: '2015-03-31'});
  var functionName = lambdaName;

  lambda.getFunction({FunctionName: functionName}, function(err, data) {
    if (err) {
      if (err.statusCode === 404) {
        var warning = 'Unable to find lambda function ' + deploy_function + '. '
        warning += 'Verify the lambda function name and AWS region are correct.'
        gutil.log(warning);
      } else {
        var warning = 'AWS API request failed. '
        warning += 'Check your AWS credentials and permissions.'
        gutil.log(warning);
      }
    }

    var params = {
      FunctionName: functionName,
      Publish: true
    };

    fs.readFile( lambdaDir + '/dist.zip', function(err, data) {
      params['ZipFile'] = data;
      lambda.updateFunctionCode(params, function(err, data) {
        if (err) {
          console.log(err);
          var warning = 'Package upload failed.';
          gutil.log(warning);
          done()
        }
      });
    });
  });
});

// The key to deploying as a single command is to manage the sequence of events.
gulp.task('default', function(callback) {
  return runSequence(
    'clean',
    ['js', 'npm'],
    'zip',
    'upload',
    callback
  );
});



gulp.task('update', function() {
  console.log('update called');
  validateLambda();

});


