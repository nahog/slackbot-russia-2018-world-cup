const translations = require("translations");
const flagsEmoji = require("./flags.json")
const schedule = require("node-schedule");
const Slack = require("slack-node");
const winston = require("winston");
const moment = require("moment");
const http = require("http");
const _ = require("lodash");
const fs = require("fs");

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
logger.info("proccess started");

const language = process.env.LANGUAGE || "es";
const locale = require("./locales/" + language + ".json");
const t = translations(locale);
const highlightedTeam = process.env.HIGHLIGHTED_TEAM || "Argentina";
const showZonesJson = process.env.SHOW_ZONES_JSON || '{ "ART": "-3", "IST": "+1" }';
const showZones = JSON.parse(showZonesJson);
const cronSchedule = process.env.CRON_SCHEDULE || "*/15 * * * * *";
const slackEnabled = process.env.SLACK_ENABLED || true;
const slackChannel = process.env.SLACK_CHANNEL || "#worldcup";
const slackBot = process.env.SLACK_BOT || "Worldcup";
const slackWebhook = process.env.SLACK_WEBHOOK || "https://hooks.slack.com/services/***";
const footballDataApiToken = process.env.FOOTBALL_DATA_API_TOKEN || "***";
const slack = new Slack();
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

logger.debug(
    "the current cron schedule for checking results is: " + cronSchedule
);

slack.setWebhook(slackWebhook);

if (!fs.existsSync(dbFile)) {
    logger.info(
        "db file does not exists, creating one from the clean db template"
    );
    fs.copyFileSync(dbCleanFile, dbFile);
}

let job = schedule.scheduleJob(cronSchedule, runJob);

function runJob() {
    const today = getToday();
    logger.info("schedule fired on: " + today.toISOString());

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

                let apiData = parseApiData(body);

                let dbData = JSON.parse(fs.readFileSync(dbFile));
                _.forEach(apiData, apiFixture => {
                    let dbFixture = _.findLast(dbData, ["id", apiFixture.id]);
                    processFixture(today, apiFixture, dbFixture);
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

    logger.info("next schedule event at: " + job.nextInvocation());
}

function processFixture(today, apiFixture, dbFixture) {
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
            } else {
                postToSlack(t("Today's match {home} vs {away} at {date}, current score {home} {homeGoals} - {awayGoals} {away}", {
                    home: homeTeamDecoration + t(apiFixture.homeTeamName) + homeTeamDecoration + " " + flagsEmoji[apiFixture.homeTeamName],
                    away: flagsEmoji[apiFixture.awayTeamName] + " " + awayTeamDecoration + t(apiFixture.awayTeamName) + awayTeamDecoration,
                    homeGoals: apiFixture.goalsHomeTeam,
                    awayGoals: apiFixture.goalsAwayTeam,
                    date: matchHour
                }));
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

function postToSlack(message) {
    logger.info("new message to post: " + message);
    logger.info("posting as " + slackBot + " in " + slackChannel);
    if (slackEnabled) {
        logger.info("slack is enabled, posting");
        slack.webhook({
            channel: slackChannel,
            username: slackBot,
            text: message
        }, (error, response) => {
            if (error) {
                logger.error(error);
            } else {
                logger.debug("slack webhook response: " + JSON.stringify(response))
                logger.info("slack is enabled, posted ok");
            }
        });
    } else {
        logger.info("slack is not enabled, not posting");
    }
}

function parseApiData(body) {
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

process.on("uncaughtException", error => {
    try {
        logger.error(error);
    } catch (exception) {
        console.log("exception: " + exception);
        console.log("error: " + error);
    }
});