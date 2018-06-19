const translations = require("translations");
const schedule = require("node-schedule");
const Slack = require("slack-node");
const winston = require("winston");
const moment = require("moment");
const fs = require("fs");

let config = {};
if (fs.existsSync("./config.json")) {
    config = require("./config.json");
}

config.logLevel = process.env.LOG_LEVEL || config.logLevel || "info";
const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            format: winston.format.json(),
            filename: "error.log",
            level: "error"
        }),
        new winston.transports.File({
            format: winston.format.printf(l => `${moment().toISOString()} ${l.level} ${l.message}`),
            filename: "index.html",
            level: config.logLevel
        }),
        new winston.transports.Console({
            format: winston.format.cli(),
            level: config.logLevel
        })
    ]
});
logger.info("proccess started");

config.language = process.env.LANGUAGE || config.language || "en"; // The "es" language is already implemented, for others you need to create a new file in the locales folder
const locale = require("./locales/" + config.language + ".json");
const t = translations(locale);
config.cronSchedule = process.env.CRON_SCHEDULE || config.cronSchedule || "*/15 * * * *";
config.slackEnabled = process.env.SLACK_ENABLED === "true" || config.slackEnabled || true;
config.slackChannel = process.env.SLACK_CHANNEL || config.slackChannel || "#worldcup";
config.slackBot = process.env.SLACK_BOT || config.slackBot || "Worldcup";
config.slackWebhook = process.env.SLACK_WEBHOOK || config.slackWebhook || "https://hooks.slack.com/services/***";
const slack = new Slack();
const actionModule = process.argv[2];

logger.debug(
    "the current cron schedule for calling the " + actionModule + " action is: " + config.cronSchedule
);

const slackWebhookBackup = config.slackWebhook;
config.slackWebhook = "***";
logger.debug("current config: " + JSON.stringify(config));
config.slackWebhook = slackWebhookBackup;

slack.setWebhook(config.slackWebhook);
var action = require("./actions/" + actionModule + "/index.js");
let job = schedule.scheduleJob(config.cronSchedule, runJob);
logger.info("first event will fire at: " + job.nextInvocation());

config.enableStaticWeb = process.env.ENABLE_STATIC_WEB === "true" || config.enableStaticWeb || false;
if (config.enableStaticWeb) {
    logger.info("static web server enabled");
    const path = require('path')
    const port = process.env.PORT || 80
    const express = require("express");
    const app = express();
    app.get('*', function (request, response) {
        response.sendFile(path.resolve('index.html'))
    })
    app.listen(port);
}

function runJob() {
    logger.info("schedule fired on: " + new Date());
    action(logger, t, postToSlack);
    logger.info("next schedule event at: " + job.nextInvocation());
}

function postToSlack(message) {
    logger.info("new message to post: " + message);
    logger.info("posting as " + config.slackBot + " in " + config.slackChannel);
    if (config.slackEnabled) {
        logger.info("slack is enabled, posting");
        slack.webhook({
            channel: config.slackChannel,
            username: config.slackBot,
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
        if (error.stack) {
            logger.error(error.stack);
        }
    } catch (exception) {
        console.log("exception: " + exception);
        console.log("error: " + error);
    }
});