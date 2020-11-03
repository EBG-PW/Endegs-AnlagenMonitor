require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const mysql = require('mysql');
const SqlString = require('sqlstring');
const randomstring = require('randomstring');

const db = mysql.createPool({
  connectionLimit: 100,
  host: process.env.MySQL_Login_Host,
  user: process.env.MySQL_Login_Name,
  password: process.env.MySQL_Login_Passwort,
  database: 'vwtreffen',
  charset: 'utf8mb4_bin'
});

const InsertTreffen = 'INSERT INTO events (NameErsteller, MailErsteller, AccesKey, EventName, EventArt, Zeit, ZeitUnix, Adresse, URI, Beschreibung, Verifiziert, Abgesagt, Icon) VALUES ?';

const Telebot = require('telebot');

const bot = new Telebot({
  token: process.env.VWTreffen_TG_Bot_Token,
  limit: 1000
});

const PluginConfig = {
  Eventart: ['Treffen', 'Ausfahrt', 'Stammtisch', 'Sonstiges']
};

/* Plugin info */
const PluginName = 'EBG-VWTreffen';
const PluginRequirements = [];
const PluginVersion = '0.0.2';
const PluginAuthor = 'BolverBlitz';
const PluginDocs = '';

const POSTlimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});
const GETlimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

const router = express.Router();

const schemaPost = Joi.object({
  Eventname: Joi.string().max(256).required().regex(/^[a-z\d\s\-\.\,\ä\ü\ö\ß\&\(\)\"\!\?\+\*\/\<\>\|]*$/i),
  Eventart: Joi.number().max(3).required(),
  Date: Joi.string().trim().required().regex(/^(?:(?:31(\.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(\.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\.)0?2\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})$/),
  Time: Joi.string().trim().required().regex(/([01]?[0-9]|2[0-3]):[0-5][0-9]/),
  Adresse: Joi.string().trim().max(256).required().regex(/^[a-z\d\s\-\.\,\ä\ü\ö\ß\&\(\)\"\!\?\+\*\/\<\>\|]*$/i),
  URL: Joi.string().max(256).uri().allow(''),
  Beschreibung: Joi.string().trim().max(1024).required().regex(/^[a-z\d\s\-\.\,\ä\ü\ö\ß\&\(\)\"\!\?\+\*\/\<\>\|]*$/i),
});

const schemaGet = Joi.object({
  limit: Joi.number().max(50),
  timestamp: Joi.number(),
  eventname: Joi.string().max(256).allow('')
});

router.post('/', POSTlimiter, async (reg, res, next) => {
  try {
    const value = await schemaPost.validateAsync(reg.body);
    const RString = randomstring.generate({
      length: 24,
      charset: 'hex'
		  });
    const DateTime = `${value.Date} ${value.Time}`;
    const ZeitTemp = value.Time.split(':');
    const TimeSplit = value.Date.split('.');
    const newDate = `${TimeSplit[1]}/${TimeSplit[0]}/${TimeSplit[2]}`;
    const TimeUnix = new Date(newDate).getTime() + ZeitTemp[0] * 60 * 60 * 1000 + ZeitTemp[1] * 60 * 1000;
    const values = [
      ['Zu Kompliziert', 'Zu Kompliziert', RString, value.Eventname, PluginConfig.Eventart[value.Eventart], DateTime, TimeUnix, value.Adresse, value.URL, value.Beschreibung, 'false', 'false', 'undefined']
    ];
    db.getConnection((err, connection) => {
      if (err) {
        const Message = `Critital Error in POST/\n\nError: ${err.code}\nMessage: ${err.sqlMessage}\nData: ${err.sql}`;
        bot.sendMessage(`${process.env.Telegram_Admin_Chat_ID}`, Message, { parseMode: 'html', webPreview: false }).catch((error) => console.log('Error: (Telegram Send Message)', error.description));
        res.status(503);
        res.json({
          message: 'Database error!'
        });
      } else {
        connection.query(InsertTreffen, [values], (err, result) => {
          if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
              res.status(400);
              res.json({
                message: 'Duplicated Entry'
              });
            } else {
              const Message = `Critital Error in POST/\n\nError: ${err.code}\nMessage: ${err.sqlMessage}\nData: ${err.sql}`;
              bot.sendMessage(`${process.env.Telegram_Admin_Chat_ID}`, Message, { parseMode: 'html', webPreview: false }).catch((error) => console.log('Error: (Telegram Send Message)', error.description));
              res.status(503);
              res.json({
                message: 'Database error!'
              });
            }
          } else {
            // DB Write ok
            if (value.URL !== '') {
              var URIExit = value.URL;
            } else {
              var URIExit = 'Wurde nicht angegeben!';
            }
            const replyMarkup = bot.inlineKeyboard([
              [
                bot.inlineButton('Auto', { callback: `ico_0_${RString}` }),
                bot.inlineButton('Camping', { callback: `ico_1_${RString}` }),
                bot.inlineButton('Bier', { callback: `ico_2_${RString}` })
              ]
            ]);
            const Message = `Neues Event\n\n<b>Event Name:</b> <i>${value.Eventname}</i>\n<b>Event Art:</b> <i>${PluginConfig.Eventart[value.Eventart]}</i>\n<b>Startzeit:</b> <i>${DateTime}</i>\n<b>Ort:</b> <i>${value.Adresse}</i>\n<b>Webseite:</b> <i>${URIExit}</i>\n\n<pre language="c++">${value.Beschreibung}</pre>`;
            bot.sendMessage(`${process.env.Telegram_Admin_Chat_ID}`, `${Message}\n\nWähle ein passendes Icon:`, { parseMode: 'html', webPreview: false, replyMarkup }).catch((error) => console.log('Error: (Telegram Send Message)', error.description));
            res.json(value);
          }
        });
        connection.release();
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', GETlimiter, async (reg, res, next) => {
  try {
    const value = await schemaGet.validateAsync(reg.query);
    const TimeNow = new Date().getTime();

    if (!reg.query.limit) {
      if (reg.query.timestamp) {
        if (reg.query.eventname) {
          var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? AND EventName LIKE ? ORDER BY ZeitUnix ASC;', [value.timestamp, `%${value.eventname}%`]);
        } else {
          var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? ORDER BY ZeitUnix ASC;', [value.timestamp]);
        }
      } else if (reg.query.eventname) {
        var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? AND EventName LIKE ? ORDER BY ZeitUnix ASC;', [TimeNow, `%${value.eventname}%`]);
      } else {
        var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? ORDER BY ZeitUnix ASC;', [TimeNow]);
      }
    } else if (reg.query.timestamp) {
      if (reg.query.eventname) {
        var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? AND EventName LIKE ? ORDER BY ZeitUnix ASC LIMIT ?;', [value.timestamp, `%${value.eventname}%`, value.limit]);
      } else {
        var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? ORDER BY ZeitUnix ASC LIMIT ?;', [value.timestamp, value.limit]);
      }
    } else if (reg.query.eventname) {
      var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? AND EventName LIKE ? ORDER BY ZeitUnix ASC LIMIT ?;', [TimeNow, `%${value.eventname}%`, value.limit]);
    } else {
      var GetSQL = SqlString.format('SELECT EventName,EventArt,Zeit,Adresse,URI,Beschreibung,Icon FROM events where Verifiziert = "true" AND Abgesagt = "false" AND ZeitUnix > ? ORDER BY ZeitUnix ASC LIMIT ?;', [TimeNow, value.limit]);
    }

    db.getConnection((err, connection) => {
      connection.query(GetSQL, (err, rows, fields) => {
        if (!err) {
          if (Object.entries(rows).length === 0) {
            res.status(500);
            res.json({
              error: 'No data was found'
            });
          } else {
            res.json({
              rows
            });
          }
        } else {
          res.status(503);
          res.json({
            error: 'Database error!'
          });
        }
      });
      connection.release();
    });
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
