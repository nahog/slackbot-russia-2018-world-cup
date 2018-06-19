const request = require('request');
const cheerio = require('cheerio');
const _ = require('lodash');
const fs = require('fs');

const databaseFile = "coperos.json";
const scrapUrl = "https://www.coperos.com/torneos/" + process.env.COPEROS_TOURNAMENT;

module.exports = function(logger, t, postToSlack) {
    logger.debug("current config: " + JSON.stringify({
        COPEROS_TOURNAMENT: process.env.COPEROS_TOURNAMENT
    }));
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
        fs.writeFileSync(databaseFile, "[]");
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

    const databaseAsString = JSON.stringify(newData, null, 4);
    logger.log("silly", databaseAsString);
    fs.writeFileSync(databaseFile, databaseAsString);
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