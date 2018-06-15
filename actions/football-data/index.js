const flagsEmoji = require("./flags.json")
const schedule = require("node-schedule");
const config = require("./config.json");
const moment = require("moment");
const http = require("http");
const _ = require("lodash");
const fs = require("fs");

const highlightedTeam = process.env.HIGHLIGHTED_TEAM || config.highlightedTeam || "Argentina"; // It should match the team name that comes from the Api
const showZonesJson = process.env.SHOW_ZONES_JSON || config.showZonesJson || '{ "ART": "-3", "IST": "+1" }';
const showZones = JSON.parse(showZonesJson);
const footballDataApiToken = process.env.FOOTBALL_DATA_API_TOKEN || config.footballDataApiToken || "***";
const dbFile = "db.json";
const dbCleanFile = "db.clean.json";
const dataApiOptions = {
    host: "api.football-data.org",
    port: 80,
    path: "/v1/competitions/467/fixtures",
    method: "GET",
    headers: {
        "X-Auth-Token": footballDataApiToken
    }
};

module.exports = function(logger, t, postToSlack) {
    if (!fs.existsSync(dbFile)) {
        logger.info(
            "db file does not exists, creating one from the clean db template"
        );
        fs.copyFileSync(dbCleanFile, dbFile);
    }

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

            let apiData = parseApiData(logger, body);

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

function processFixture(logger, t, postToSlack, today, apiFixture, dbFixture) {
    logger.log("silly", "processing match: " + apiFixture.id);

    const homeTeamDecoration = apiFixture.homeTeamName === highlightedTeam ? "*" : "";
    const awayTeamDecoration = apiFixture.awayTeamName === highlightedTeam ? "*" : "";

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

function parseApiData(logger, body) {
    let apiData = [];
    const bodyData = JSON.parse(body);
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