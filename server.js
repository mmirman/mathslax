var querystring = require('querystring');
var http = require('http');
var fs = require('fs');

const express = require('express');
const bodyparser = require('body-parser');
const pug = require('pug');
// const util = require('util');
const entities = require('entities');

const log = require('./lib/log');
const typeset = require('./lib/typeset.js');

const SERVER = process.env.SERVER || '127.0.0.1';
const PORT = process.env.PORT || '8080';
const SLACK_AUTH_TOKEN = process.env.SLACK_AUTH_TOKEN || 'none';

// Install the routes.
const router = express.Router();

router.post('/typeset', function(req, res) {

  if (req.body.token !== SLACK_AUTH_TOKEN)
  {
    log.warn('Unrecongized or no token:',req.body.token);
    res.status(401).send();
    return;
  }

  var requestString = entities.decode(req.body.text);

  log.info('Request:',requestString);

  var typesetPromise = typeset.typeset(requestString, '');

  if (typesetPromise === null) {
    res.send('no text found to typeset');
    res.end(); 
    return;
  }

  var promiseSuccess = function(mathObjects) {
    var locals = {'mathObjects': mathObjects,
      'serverAddress': `http://${SERVER}/` }; // :${PORT}
    var htmlResult = pug.renderFile('./views/slack-response.pug', locals);
    res.json({'text' : htmlResult});
    res.end();
  };

  var promiseError = function(error) {
    log.info('Error in typesetting:');
    log.info(error);
    res.end(); // Empty 200 response.
  };

  typesetPromise.then(promiseSuccess, promiseError);

});

router.post('/slashtypeset', function(req, res) {

  if (req.body.token !== SLACK_AUTH_TOKEN)
  {
    log.warn('Unrecongized or no token:',req.body.token);
    res.status(401).send();
    return;
  }

  var requestString = entities.decode(req.body.text);

  var typesetPromise = typeset.typeset(requestString,'');

  if (typesetPromise === null) {
    res.send('no text found to typeset');
    res.end(); // Empty 200 response -- no text was found to typeset.
    return;
  }
  log.info("Recieved: " + JSON.stringify(req.body));
/* {"token":"sXxj8Y1crfbrGRqRupvActL4",
  "team_id":"T9HLTFN2Y",
"team_domain":"ethsrl",
"channel_id":"C9X0EEM2R",
"channel_name":"mathtest",
"user_id":"U9HLTFNDS",
"user_name":"matthew.mirman",
"command":"/math",
"text":"x+4",
"response_url":"https://hooks.slack.com/commands/T9HLTFN2Y/337935589095/8MLmuahzSjeE2L6LaUOZaiPv",
"trigger_id":"337031277557.323707532100.b2cb43f39fe180fa40e741fde43af075"}
*/
  var promiseSuccess = function(mathObjects) {
    //var locals = {'mathObjects': mathObjects,
    //             'serverAddress': SERVER!='127.0.0.1' ?
    //             util.format('http://%s:%s/', SERVER, PORT) :
    //             'http://'+req.headers.host+'/' };
    var post_data = querystring.stringify({
      //token: 'xoxp-323707532100-323707532468-337924055719-41abb0dec753331ef7af48c3a10402a9'
      token: req.body.token,
      channel: req.body.channel_name,
      as_user: req.body.user_name,
      attachments: [
        {
          fallback: requestString,
          image_url: 'http://' + SERVER + /* ':' + PORT + */ '/'
            + mathObjects[0].output
        },
      ],
      pretty: 1
    });

    var post_options = {
      host: 'https://slack.com',
      port: '80',
      path: '/chat.postMessage',
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(post_data)
      }
    };
    var post_req = http.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          log.info('Response: ' + chunk);
      });
    });

    res.json({
      response_type: 'in_channel',
      //text: requestString,
      attachments: [
        {
          fallback: requestString,
          image_url: 'http://' + SERVER + /* ':' + PORT + */ '/'
            + mathObjects[0].output
        },
      ],
    });
    res.end();
  };

  var promiseError = function(error) {
    log.info('Error in typesetting:');
    log.info(error);
    res.end(); // Empty 200 response.
  };

  typesetPromise.then(promiseSuccess, promiseError);

});


// Start the server.
var app = express();

app.disable('x-powered-by');
app.use( (req,res,next) => {
  res.header('X-Powered-By','Love');
  next();
});
app.use(log.middleware);
app.use(bodyparser.urlencoded({extended: true}));
app.use(bodyparser.json());
app.use('/static', express.static('static'));
app.use('/', router);

app.listen(PORT);
log.info(`Mathslax is listening at http://${SERVER}:${PORT}/`);
log.info('Make a test request with something like:');
log.info(`curl -v -X POST ${SERVER}:${PORT}/typeset --data ` +
            '\'{"text": "f(x) = E_0\\frac{x^2}{sin(x)}", "token": "none"}\' ' +
            '-H "Content-Type: application/json"');
log.info('****************************************');
