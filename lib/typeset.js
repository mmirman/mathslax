const mathjax = require('mathjax-node-svg2png');

var FILE_PATH = 'static';

const _ = require('underscore');
const q = require('q');
const fs = require('fs');
const crypto = require('crypto');

const log = require('./log');

mathjax.start();

// Application logic for typesetting.
const extractRawMath = function(text, setType) {
  // eslint-disable-next-line no-useless-escape
  var mathRegex = new RegExp('^\s*' + setType + '\s*((\n|.)*)','g');
  var results = [];
  var match;

  while ((match = mathRegex.exec(text)) !== null)
  {
    results.push({ // mathObject
      matchedText: match[0],
      input: match[1],
      output: null,
      error: null,
    });
  }

  return results;
};

const createFileName = (basedOn) => {
  return( `${FILE_PATH}/${crypto
    .createHash('sha256')
    .update(basedOn)
    .digest('hex')}.png`);
};

const renderMath = (mathObject, parseOptions) => {

  const defaultOptions = {
    math: mathObject.input,
    format: 'TeX',
    png: true,
    font: 'TeX',
    width: 600,
    scale: 5,
    linebreaks: true,
    timeout: 30 * 1000,
  };

  const typesetOptions = _.extend(defaultOptions, parseOptions);
  const deferred = q.defer();

  const filepath = createFileName(mathObject.input);

  if (!fs.existsSync(filepath))
  {
    mathjax.typeset(typesetOptions, (result) => {

      if (!result || !result.png || !!result.errors)
      {
        mathObject.error = new Error('Invalid response from MathJax.');
        mathObject.output = result;
        deferred.reject(mathObject);
        return;
      }
    
      log.info('writing new PNG: %s', filepath);
      const pngData = new Buffer(result.png.slice(22), 'base64');

      fs.writeFile(filepath, pngData, (error) => {
        if (error) {
          mathObject.error = error;
          mathObject.output = null;
          deferred.reject(mathObject);
        }
      });
      mathObject.output = filepath;
      deferred.resolve(mathObject);
    });
  } else {
    // Don't bother re-rendering if it already exists
    log.info('using existing PNG: %s', filepath);
    mathObject.output = filepath;
    deferred.resolve(mathObject);
  }

  return deferred.promise;
};

const typeset = function(text, setType) {

  var rawMathArray = extractRawMath(text,setType);

  if (rawMathArray.length === 0) {
    return null;
  }
  return q.all(_.map(rawMathArray, renderMath));
};

module.exports = {
  typeset: typeset,
  extractRawMath: extractRawMath,
  createFileName: createFileName,
  FILE_PATH: FILE_PATH
};
