require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
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
  IPAddress: Joi.number().regex(/\b((?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:(?<!\.)\b|\.)){4}/).required(),
  AnlagenName: Joi.string().regex(/^[a-z\d\s\-\.\,\ä\ü\ö\ß\&]*$/i).required(),
});

const schemaDelete = Joi.object({
  IPAddress: Joi.number().regex(/\b((?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:(?<!\.)\b|\.)){4}/).required(),
});

router.get('/', GETlimiter, async (reg, res, next) => {
  try {
    const TimeNow = new Date().getTime();



  } catch (error) {
    next(error);
  }
});

router.post('/', POSTlimiter, async (reg, res, next) => {
  try {
    const value = await schemaPost.validateAsync(reg.query);
    if(fs.existsSync(`${process.env.Anlagen_DB}/Anlagen.json`)){
      var AnlagenJson = JSON.parse(fs.readFileSync(`${process.env.Anlagen_DB}/Anlagen.json`));
      if(!AnlagenJson["IP"].includes(value.IPAddress)){
        AnlagenJson["AnlagenName"].push(value.AnlagenName);
        AnlagenJson["IP"].push(value.IPAddress);
        
        let NewJson = JSON.stringify(AnlagenJson);
        fs.writeFile(`${process.env.Anlagen_DB}/Anlagen.json`, NewJson, (err) => {if (err) console.log(err);});
      }else{
        res.status(400);
        res.json({
          message: 'Duplicated Entry'
        });
      }

    }


  } catch (error) {
    next(error);
  }
});

router.delete('/', POSTlimiter, async (reg, res, next) => {
  try {
    const value = await schemaPost.validateAsync(reg.query);



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
