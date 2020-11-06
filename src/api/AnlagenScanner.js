require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const Joi = require('joi');

const PluginConfig = {
};

/* Plugin info */
const PluginName = 'AnlagenScanner';
const PluginRequirements = [];
const PluginVersion = '0.0.1';
const PluginAuthor = 'BolverBlitz';
const PluginDocs = '';

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
    const TimeNow = new Date().getTime();



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

module.exports = {
  router,
  PluginName,
  PluginRequirements,
  PluginVersion,
  PluginAuthor,
  PluginDocs
};
