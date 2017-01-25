'use strict';

var es = require('event-stream');
var knox = require('knox');
var gutil = require('gulp-util');
var mime = require('mime');
mime.default_type = 'text/plain';

module.exports = function (aws, options) {
  options = options || {};

  var client = knox.createClient(aws);
  var waitTime = 0;
  var regexGzip = /\.([a-z]{2,})\.gz$/i;
  var regexGeneral = /\.([a-z]{2,})$/i;

  return es.map(function (file, finished) {
  if (!file.isBuffer()) { return file; }

    var uploadPath = file.path.replace(file.base, options.uploadPath || '');
    uploadPath = uploadPath.replace(new RegExp('\\\\', 'g'), '/');
    
    var headers = { 'x-amz-acl': 'public-read' };

    if (options.headers) {
      for (var key in options.headers) {
        headers[key] = options.headers[key];
      }
    }

    if (regexGzip.test(file.path)) {
      headers['Content-Encoding'] = 'gzip';
      if (options.gzippedOnly) {
        uploadPath = uploadPath.substring(0, uploadPath.length - 3);
      }
    } else if (options.gzippedOnly) {
      return file;
    }

    // Set content type based on file extension
    if (!headers['Content-Type'] && regexGeneral.test(uploadPath)) {
      headers['Content-Type'] = mime.lookup(uploadPath);
      if (options.encoding) {
        headers['Content-Type'] += '; charset=' + options.encoding;
      }
    }

    headers['Content-Length'] = file.stat.size;

    client.putBuffer(file.contents, uploadPath, headers, function(err, res) {
      if (err || res.statusCode !== 200) {
        gutil.log(gutil.colors.red('[FAILED]', file.path + " -> " + uploadPath));
        gutil.log(gutil.colors.red('  HTTP STATUS:', res.statusCode));
        gutil.log(gutil.colors.red('  AWS ERROR:', err));
        finished(err, null)
      } else {
        gutil.log(gutil.colors.green('[SUCCESS]', file.path + " -> " + uploadPath));
        res.resume();
        finished(null, file)
      }
    });
  });
};