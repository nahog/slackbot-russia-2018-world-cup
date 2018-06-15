const config = require("./config.json");
const request = require('request');
const cheerio = require('cheerio');

const tournament = process.env.COPEROS_TOURNAMENT || config.coperosTournament || "rusia_2018_1.html";
const scrapUrl = "https://www.coperos.com/torneos/" + tournament;

module.exports = function(logger, t, postToSlack) {
    request(scrapUrl, function (error, response, html) {
        if (!error && response.statusCode == 200) {
            let $ = cheerio.load(html);
            let result = getJsonFromHtml($);
            
            processCoperosResult(t, postToSlack, result);
        }
    });
}

function processCoperosResult(t, postToSlack, result) {
    let coperosRooster = t("Current www.coperos.com :soccer: rooster:") + "\n";
    for (let index = 0; index < result.length; index++) {
        const item = result[index];
        let icon = "";
        switch (index) {
            case 0:
                icon = ":first_place_medal: ";
                break;
            case 1:
                icon = ":second_place_medal: ";
                break;
            case 2:
                icon = ":third_place_medal: ";
                break;
            case (result.length - 1):
                icon = ":sob: ";
                break;
        }
        coperosRooster += `${item.position}. ${icon}${item.user} (${item.score})\n`;
    }
    postToSlack(coperosRooster);
}

function getJsonFromHtml($) {
    let i = 0;
    let result = [];
    $('#tablaUsuarios > tbody > tr').each(function () {
        if ($(this).children('td').length > 1) // avoid title
        {
            i++;
            let data = {
                position: i,
                user: $(this).children('.username').children().html(),
                score: $(this).children('.puntaje').html(),
            };
            result.push(data);
        }
    });
    return result;
}