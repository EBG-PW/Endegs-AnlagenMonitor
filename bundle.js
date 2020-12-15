(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const Joi = require('joi');
const ping = require('ping');

const PluginConfig = {
};

/* Plugin info */
const PluginName = 'AnlagenScanner';
const PluginRequirements = [];
const PluginVersion = '0.0.1';
const PluginAuthor = 'BolverBlitz';
const PluginDocs = '';

//Global Vars
var HasChanced = true;
var AnlagenBuffer;
var StatusListe;

function UpdateStatus() {
  var Promises = [];
  if(HasChanced){
    if(fs.existsSync(`${process.env.Anlagen_DB}/Anlagen.json`)){
      AnlagenBuffer = JSON.parse(fs.readFileSync(`${process.env.Anlagen_DB}/Anlagen.json`));
      HasChanced = false;
    }
  }
  AnlagenBuffer["IP"].map(ipv4 => {
    Promises.push(ping.promise.probe(ipv4))
  });
  var AliveNum = 0;
  var NotAliveNum = 0;
  var StatusArr = [];

  Promise.all(Promises).then(function(PAll) {
    PAll.map(Info => {
        if(Info.alive){
            //console.log(`Host:${Info.host} Ping:${Info.avg}ms`)
            let index = AnlagenBuffer["IP"].indexOf(Info.host);
            StatusArr.push({IP: Info.host, Name: AnlagenBuffer["AnlagenName"][index], Ping: Info.avg})
            AliveNum++
        }else{
            NotAliveNum++
        }
    });
    StatusListe = {
      Timestamp: Date.now(),
      Online: AliveNum,
      Offline: NotAliveNum,
      List: StatusArr
    }
  });
}

UpdateStatus()

if(!fs.existsSync(`${process.env.Anlagen_DB}/Anlagen.json`)){
	const CleanDB = {"AnlagenName":[],"IP":[]}
	let NewJson = JSON.stringify(CleanDB);
	fs.writeFile(`${process.env.Anlagen_DB}/Anlagen.json`, NewJson, (err) => {if (err) console.log(err);});
	console.log(`[API.Plugins] [${PluginName}] created DB`)
}

function removeItemFromArrayByName(arr) {
  var what, a = arguments, L = a.length, ax;
  while (L > 1 && arr.length) {
      what = a[--L];
      while ((ax= arr.indexOf(what)) !== -1) {
          arr.splice(ax, 1);
      }
  }
  return arr;
}

const GETlimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});

const POSTlimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40
});

const router = express.Router();

const schemaPost = Joi.object({
  IPAddress: Joi.string().required().regex(/\b((?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:(?<!\.)\b|\.)){4}/),
  AnlagenName: Joi.string().required().regex(/^[a-z\d\s\-\.\,\ä\ü\ö\ß\&]*$/i),
});

const schemaDelete = Joi.object({
  IPAddress: Joi.string().required().regex(/\b((?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:(?<!\.)\b|\.)){4}/),
});

router.get('/', GETlimiter, async (reg, res, next) => {
  try {
    if(typeof(StatusListe) === undefined){
      res.status(500);
    }else{
      if(Date.now()-StatusListe.Timestamp <= (process.env.UpdateInterval*2)){
        res.status(200);
        res.json(StatusListe);
      }else{
        res.status(500);
      }
    }

  } catch (error) {
    next(error);
  }
});

router.post('/add', POSTlimiter, async (reg, res, next) => {
  try {
    const value = await schemaPost.validateAsync(reg.body);
    if(fs.existsSync(`${process.env.Anlagen_DB}/Anlagen.json`)){
      var AnlagenJson = JSON.parse(fs.readFileSync(`${process.env.Anlagen_DB}/Anlagen.json`));
      if(!AnlagenJson["IP"].includes(value.IPAddress)){
        AnlagenJson["AnlagenName"].push(value.AnlagenName);
        AnlagenJson["IP"].push(value.IPAddress);

        let NewJson = JSON.stringify(AnlagenJson);
        fs.writeFile(`${process.env.Anlagen_DB}/Anlagen.json`, NewJson, (err) => {if (err) console.log(err);});
        HasChanced = true;

        res.status(200);
        res.json({
          message: 'Anlage wurde gespeichert'
        });

      }else{
        res.status(500);
        res.json({
          error: 'Duplicated Entry'
        });
      }

    }


  } catch (error) {
    next(error);
  }
});

router.post('/rem', POSTlimiter, async (reg, res, next) => {
  try {
    const value = await schemaDelete.validateAsync(reg.body);
    if(fs.existsSync(`${process.env.Anlagen_DB}/Anlagen.json`)){
      var AnlagenJson = JSON.parse(fs.readFileSync(`${process.env.Anlagen_DB}/Anlagen.json`));
      if(AnlagenJson["IP"].includes(value.IPAddress)){
        let index = AnlagenJson["IP"].indexOf(value.IPAddress);
					if (index > -1) {
						AnlagenJson["AnlagenName"].splice(index, 1);
					}
        removeItemFromArrayByName(AnlagenJson["IP"], value.IPAddress)

        let NewJson = JSON.stringify(AnlagenJson);
        fs.writeFile(`${process.env.Anlagen_DB}/Anlagen.json`, NewJson, (err) => {if (err) console.log(err);});
        HasChanced = true;

        res.status(200);
        res.json({
          message: 'Anlage wurde gespeichert'
        });

      }else{
        res.status(500);
        res.json({
          error: 'IP not found'
        });
      }

    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

setInterval(function(){
  UpdateStatus()
}, process.env.UpdateInterval);

},{"dotenv":undefined,"express":undefined,"express-rate-limit":undefined,"fs":undefined,"joi":undefined,"ping":undefined}],2:[function(require,module,exports){
(function (__dirname){(function (){
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const { expressCspHeader, INLINE, NONE, SELF } = require('express-csp-header');

require('dotenv').config();

const middlewares = require('./middlewares');
const api = require('./api/AnlagenScanner');

const app = express();
//app.set('trust proxy', 1); // If Behind PROXY

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(expressCspHeader({
  directives: {
      'default-src': [SELF],
      'script-src': [SELF, INLINE, 'somehost.com'],
      'style-src': [SELF, 'mystyles.net'],
      'img-src': ['data:', 'images.com'],
      'worker-src': [NONE],
      'block-all-mixed-content': true
  }
}));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', express.static('./src/web'))

app.get('/lawstuff', (req, res) => {
  res.sendFile(path.join(`${__dirname}/html/lawstuff.html`));
});


app.use('/api/v1/AnlagenScanner', api);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;

}).call(this)}).call(this,"/src")
},{"./api/AnlagenScanner":1,"./middlewares":4,"body-parser":undefined,"cors":undefined,"dotenv":undefined,"express":undefined,"express-csp-header":undefined,"helmet":undefined,"morgan":undefined,"path":undefined}],3:[function(require,module,exports){
const app = require('./app');

const port = process.env.PORT || 5000;
app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening: ${process.env.IP}:${port}`);
  /* eslint-enable no-console */
});
},{"./app":2}],4:[function(require,module,exports){
function notFound(req, res, next) {
  res.status(404);
  const error = new Error(`Not Found - ${req.originalUrl}`);
  next(error);
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  /* eslint-enable no-unused-vars */
  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  /* Returns 400 if the client didn´t provide all data/wrong data type */
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  res.status(statusCode);
  res.json({
    message: err.message
  });
}

module.exports = {
  notFound,
  errorHandler
};

},{}]},{},[3]);
