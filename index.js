const translations = require("translations");
const schedule = require("node-schedule");
const Slack = require("slack-node");
const winston = require("winston");
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

const language = process.env.LANGUAGE || "en"; // The "es" language is already implemented, for others you need to create a new file in the locales folder
const locale = require("./locales/" + language + ".json");
const t = translations(locale);
const cronSchedule = process.env.CRON_SCHEDULE || "*/10 * * * * *";
const slackEnabled = process.env.SLACK_ENABLED || false;
const slackChannel = process.env.SLACK_CHANNEL || "#worldcup";
const slackBot = process.env.SLACK_BOT || "Worldcup";
const slackWebhook = process.env.SLACK_WEBHOOK || "https://hooks.slack.com/services/***";
const slack = new Slack();

logger.debug(
    "the current cron schedule for calling the action is: " + cronSchedule
);

slack.setWebhook(slackWebhook);
var action = require("./actions/" + process.argv[2]);
let job = schedule.scheduleJob(cronSchedule, runJob);

function runJob() {
    logger.info("schedule fired on: " + new Date());
    action(logger, t, postToSlack);
    logger.info("next schedule event at: " + job.nextInvocation());
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

process.on("uncaughtException", error => {
    try {
        logger.error(error);
    } catch (exception) {
        console.log("exception: " + exception);
        console.log("error: " + error);
    }
});
