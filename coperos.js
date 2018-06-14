const winston = require("winston");
const scrapurl = "https://www.coperos.com/torneos/binagora_268.html#sthash.Vk3ris7R.R7T9SZoD.dpbs";
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "debug",
    format: winston.format.cli(),
    transports: [
        new winston.transports.File({
            filename: "error.log",
            level: "error"
        }),
        new winston.transports.Console()
    ]
});
const request = require('request');
const cheerio = require('cheerio');

var getJsonFromHtml = function($){
    var i = 0;
    var result = [];
    $('#tablaUsuarios > tbody > tr').each(function() {
        if ($(this).children('td').length > 1) // avoid title
        {
            i++;
            var data = {
                position: i,
                user: $(this).children('.username').children().html(),
                score: $(this).children('.puntaje').html(),
           };
           result.push(data);   
        }
      });
      return result;
}

var printResult = function(result){
    logger.info(JSON.stringify(result));
}

var cooperos = (function () {
    return {
      load:function(callback) {
        logger.info("load");
        request(scrapurl, function (error, response, html) {
            if (!error && response.statusCode == 200) {
                var $ = cheerio.load(html);
                var result = getJsonFromHtml($);
                callback(result);
              }
        });
      }
    }
  })();
  
 cooperos.load(printResult);