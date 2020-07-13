#foo
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

AWS.config.region = 'us-west-2';
var lambda = new AWS.Lambda({apiVersion: '2015-03-31'});    

var handleError = function (msg) {
  gutil.log(gutil.colors.red('ERROR!', msg)) ;
  process.exit(1);
}

var argv = require('yargs')
.command('info', 'get information about a currently deployed lambda')
.command('clean', 'delete the dist folder in the lambda subdirectory')
.command('js', 'Copy any javascript files into dist.')
.command('zip', 'Zip up the dist folder.')
.command('update', 'Updates an AWS Lambda, assuming it already exists.')
.option('l', {
        alias: 'lambda',
        description: 'Name of the directory that contains your function. Must be a subdirectory of ./lambda and must match the AWS function name.',
        demand: true
      })
.argv;

var lambdaName = argv.lambda;
var lambdaPath = 'lambda/' + lambdaName;
var dist = lambdaPath + '/dist';
  
//check that directory exists
try {
  fs.statSync(lambdaPath);  
} catch(e) {
  handleError(lambdaPath + ' does not exist');
}

//BEGIN TASKS

gulp.task('clean', function(done) {
  del(dist).then(function(){
   done()
  });
});

gulp.task('js', function() {
  return gulp.src( lambdaPath + '/*.js')
    .pipe(gulp.dest(dist));
});

// Here we want to install npm packages to dist, ignoring devDependencies.
gulp.task('npm', function() {
  return gulp.src( lambdaPath + '/package.json')
    .pipe(gulp.dest(dist))
    .pipe(install({production: true}));
});

gulp.task('zip', function() {
  return gulp.src([ dist + '/**/*', '!' + dist + '/package.json', dist + '/.*'])
    .pipe(zip('dist.zip'))
    .pipe(gulp.dest(dist));
});

gulp.task('info', function (done) {
  lambda.getFunction({FunctionName: lambdaName}, function(err, data) {
    if (err) {
      if (err.statusCode === 404) {
        var warning = 'Unable to find lambda function ' + lambdaName + '. '
        warning += 'Verify the lambda function name and AWS region are correct.'
        gutil.log(warning);
      } else {
        var warning = 'AWS API request failed. '
        warning += 'Check your AWS credentials and permissions.'
        gutil.log(warning);
      }
    }
    gutil.log(data.Configuration);
    done();
  });  

})

gulp.task('update', function (done) {

  var functionName = lambdaName;

    var params = {
      FunctionName: functionName,
      Publish: true
    };

    fs.readFile( dist + '/dist.zip', function(err, data) {
      if (err) handleError(err);

      params['ZipFile'] = data;
      lambda.updateFunctionCode(params, function(err, data) {
        if (err) handleError(err);
        gutil.log(gutil.colors.green('Successfully updated'), gutil.colors.cyan(lambdaName));
        gutil.log(data);
      });
    });

});

// The key to deploying as a single command is to manage the sequence of events.
gulp.task('default', function(callback) {
  return runSequence(
    'clean',
    ['js', 'npm'],
    'zip',
    'update',
    callback
  );
});


