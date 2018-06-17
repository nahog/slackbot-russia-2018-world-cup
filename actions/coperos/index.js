const config = require("./config.json");
const request = require('request');
const cheerio = require('cheerio');
const _ = require('lodash');
const fs = require('fs');

const databaseFile = "coperos.json";
const databaseCleanFile = "coperos.clean.json";
const tournament = process.env.COPEROS_TOURNAMENT || config.coperosTournament || "rusia_2018_1.html";
const scrapUrl = "https://www.coperos.com/torneos/" + tournament;

module.exports = function(logger, t, postToSlack) {
    request(scrapUrl, function (error, response, html) {
        if (!error && response.statusCode == 200) {
            let $ = cheerio.load(html);
            let result = getJsonFromHtml($);
            
            if (processDatabase(logger, result)) {
                logger.info("new changes in rooster, posting...");                
                styleAndPostToSlack(logger, t, postToSlack, result);
            }
            else {
                logger.info("no changes in rooster");
            }
        }
    });
}

function processDatabase(logger, newData) {
    logger.debug("raw data: " + JSON.stringify(newData));
    newData = _.orderBy(newData, ['score','user'], ['desc', 'asc']);
    for (let index = 0; index < newData.length; index++) {
        newData[index].position = index + 1;
    }
    logger.debug("ordered data:" + JSON.stringify(newData));
 
    if (!fs.existsSync(databaseFile)) {
        fs.copyFileSync(databaseCleanFile, databaseFile);
    }

    const databaseFileContent = fs.readFileSync(databaseFile);
    logger.debug("database data: " + databaseFileContent);
    const database = JSON.parse(databaseFileContent);

    let changed = false;
    _.forEach(newData, item => {
        let itemDb = _.findLast(database, d => d.user === item.user);
        if (itemDb) {
            item.diff = item.score - itemDb.score;
            item.positionChange = itemDb.position - item.position;
            if (item.diff !== 0 || item.positionChange !== 0) {
                changed = true;
            }
        }
        else {
            changed = true;
            item.diff = 0;
            item.positionChange = 0;
        }
    });

    logger.debug("new database data: " + JSON.stringify(newData));
    fs.writeFileSync(databaseFile, JSON.stringify(newData));
    return changed;
}

function styleAndPostToSlack(logger, t, postToSlack, result) {
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
        const plusChar = item.diff > 0 ? "+" : "";
        const diffPoints = item.diff !== 0 ? ` ${plusChar}${item.diff} pts.` : "";
        let positionChangeIcon = "";
        if (item.positionChange > 0) {
            positionChangeIcon = ":arrow_up:";
        }
        if (item.positionChange < 0) {
            positionChangeIcon = ":arrow_down:";
        }
        coperosRooster += `${item.position}. ${icon}${item.user} (${item.score} pts.)${diffPoints} ${positionChangeIcon}\n`;
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
                score: parseInt($(this).children('.puntaje').html().replace(" pts.", "")),
            };
            result.push(data);
        }
    });
    return result;
}