const flagsEmoji = require("./flags.json")
const schedule = require("node-schedule");
const moment = require("moment");
const http = require("http");
const _ = require("lodash");
const fs = require("fs");

const showZones = JSON.parse(process.env.SHOW_ZONES_JSON);
const dbFile = "football-data.json";
const dataApiOptions = {
    host: "api.football-data.org",
    port: 80,
    path: "/v1/competitions/467/fixtures",
    method: "GET",
    headers: {
        "X-Auth-Token": process.env.FOOTBALL_DATA_API_TOKEN
    }
};

module.exports = function(logger, t, postToSlack) {
    logger.debug("current config: " + JSON.stringify({
        HIGHLIGHTED_TEAM: process.env.HIGHLIGHTED_TEAM,
        SHOW_ZONES_JSON: process.env.SHOW_ZONES_JSON,
        FOOTBALL_DATA_API_TOKEN: "***" + process.env.FOOTBALL_DATA_API_TOKEN.slice(-5)
    }));

    const today = getToday();
    http
    .request(dataApiOptions, res => {
        logger.info("api call made, response: " + res.statusCode);
        logger.log("silly", "api call made, headers: " + JSON.stringify(res.headers));
        res.setEncoding("utf8");
        let body = "";
        res.on("data", chunk => {
            logger.debug("data from api call arrived");
            logger.log("silly", "data from api call arrived, chunk: " + chunk);
            body += chunk;
        });
        res.on("end", () => {
            logger.debug("data from api call completed");
            logger.log("silly", "data from api call arrived, body: " + body);

            const bodyData = JSON.parse(body);            
            let apiData = parseApiData(logger, bodyData);

            if (!fs.existsSync(dbFile)) {
                createInitialDb(today, logger, bodyData);
            }
            let dbData = JSON.parse(fs.readFileSync(dbFile));
            _.forEach(apiData, apiFixture => {
                let dbFixture = _.findLast(dbData, ["id", apiFixture.id]);
                processFixture(logger, t, postToSlack, today, apiFixture, dbFixture);
            });

            const dbDataAsString = JSON.stringify(dbData, null, 4);
            logger.log("silly", "data saved to db, dbData: " + dbDataAsString);
            fs.writeFileSync(dbFile, dbDataAsString);
            logger.info("api call process ended");
        });
        res.on("error", error => {
            logger.error(error.message);
        });
    })
    .end();
}

function createInitialDb(today, logger, apiData) {
    logger.info("creating db");
    logger.debug("processing fixtures: " + apiData.fixtures.length);
    let dbData = [];
    _.forEach(apiData.fixtures, data => {
        logger.debug("processing " + data.homeTeamName + data.awayTeamName + data.date);
        let dbDataItem = {};
        dbDataItem.id = getId(data);
        const fixtureDate = moment(data.date);
        dbDataItem.posted = fixtureDate.isBefore(today);
        dbDataItem.status = data.status;
        dbDataItem.date = data.date,
        dbDataItem.homeTeamName = data.homeTeamName;
        dbDataItem.awayTeamName = data.awayTeamName;
        dbDataItem.goalsHomeTeam = data.result.goalsHomeTeam;
        dbDataItem.goalsAwayTeam = data.result.goalsAwayTeam;
        dbData.push(dbDataItem);
    });
    const dbDataAsString = JSON.stringify(dbData, null, 4);
    logger.log("silly", dbDataAsString);
    fs.writeFileSync(dbFile, dbDataAsString);
}

function processFixture(logger, t, postToSlack, today, apiFixture, dbFixture) {
    logger.log("silly", "processing match: " + apiFixture.id);

    const homeTeamDecoration = apiFixture.homeTeamName === process.env.HIGHLIGHTED_TEAM ? "*" : "";
    const awayTeamDecoration = apiFixture.awayTeamName === process.env.HIGHLIGHTED_TEAM ? "*" : "";

    const fixtureDate = moment(apiFixture.date);

    if (
        today.date() === fixtureDate.date() &&
        today.month() === fixtureDate.month() &&
        today.year() === fixtureDate.year()
    ) {
        if (!dbFixture.posted) {
            const matchHour = getMatchHour(fixtureDate);
            if (apiFixture.goalsHomeTeam === null ||
                apiFixture.goalsAwayTeam === null) {
                postToSlack(t("Today's match {home} vs {away} at {date}", {
                    home: homeTeamDecoration + t(apiFixture.homeTeamName) + homeTeamDecoration + " " + flagsEmoji[apiFixture.homeTeamName],
                    away: flagsEmoji[apiFixture.awayTeamName] + " " + awayTeamDecoration + t(apiFixture.awayTeamName) + awayTeamDecoration,
                    date: matchHour
                }));
            }
        } else {
            if (apiFixture.status !== dbFixture.status) {
                switch(apiFixture.status) {
                    case "IN_PLAY":
                        postToSlack(t(":goal_net: {home} vs {away} match started!", {
                            home: homeTeamDecoration + t(apiFixture.homeTeamName) + homeTeamDecoration + " " + flagsEmoji[apiFixture.homeTeamName],
                            away: flagsEmoji[apiFixture.awayTeamName] + " " + awayTeamDecoration + t(apiFixture.awayTeamName) + awayTeamDecoration
                        }));
                        break;
                    case "FINISHED":
                        postToSlack(t(":sports_medal: Final results for {home} vs {away}, {home} {homeGoals} - {awayGoals} {away}", {
                            home: homeTeamDecoration + t(apiFixture.homeTeamName) + homeTeamDecoration + " " + flagsEmoji[apiFixture.homeTeamName],
                            away: flagsEmoji[apiFixture.awayTeamName] + " " + awayTeamDecoration + t(apiFixture.awayTeamName) + awayTeamDecoration,
                            homeGoals: apiFixture.goalsHomeTeam,
                            awayGoals: apiFixture.goalsAwayTeam
                        }));
                        break;
                }
            } else {
                if (
                    apiFixture.goalsHomeTeam !== dbFixture.goalsHomeTeam ||
                    apiFixture.goalsAwayTeam !== dbFixture.goalsAwayTeam
                ) {
                    postToSlack(t("New update for {home} vs {away}, {home} {homeGoals} - {awayGoals} {away}", {
                        home: homeTeamDecoration + t(apiFixture.homeTeamName) + homeTeamDecoration + " " + flagsEmoji[apiFixture.homeTeamName],
                        away: flagsEmoji[apiFixture.awayTeamName] + " " + awayTeamDecoration + t(apiFixture.awayTeamName) + awayTeamDecoration,
                        homeGoals: apiFixture.goalsHomeTeam,
                        awayGoals: apiFixture.goalsAwayTeam
                    }));
                }
            }
        }

        dbFixture.status = apiFixture.status;
        dbFixture.goalsHomeTeam = apiFixture.goalsHomeTeam;
        dbFixture.goalsAwayTeam = apiFixture.goalsAwayTeam;
        dbFixture.posted = true;
    }
}

function getMatchHour(date) {
    let hours = [];
    for (var zone in showZones) {
        if (showZones.hasOwnProperty(zone)) {
            hours.push(date.clone().utc().add(parseInt(showZones[zone]), "hours").format("LT") + " " + zone);
        }
    }
    return hours.join(", ");
}

function parseApiData(logger, bodyData) {
    let apiData = [];
    if (!bodyData || bodyData.error) {
        logger.error(bodyData.error);
        return apiData;
    }
    _.forEach(bodyData.fixtures, fixture => {
        apiData.push({
            id: getId(fixture),
            posted: false,
            status: fixture.status,
            date: fixture.date,
            homeTeamName: fixture.homeTeamName,
            awayTeamName: fixture.awayTeamName,
            goalsHomeTeam: fixture.result.goalsHomeTeam,
            goalsAwayTeam: fixture.result.goalsAwayTeam
        });
    });
    return apiData;
}

function getId(fixture) {
    // After this date there is only one match per day and we dont know the
    // teams yet, so the id is just the date
    if (moment(fixture.date).isAfter("2018-06-30T00:00:00Z")) {
        return fixture.date;
    }
    return fixture.date + "_" + fixture.homeTeamName + "_" + fixture.awayTeamName;
}

function getToday() {
    return moment();
}