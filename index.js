const translations = require("translations");
const schedule = require("node-schedule");
const Slack = require("slack-node");
const winston = require("winston");
const moment = require("moment");
const fs = require("fs");

require('dotenv').config()

const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            format: winston.format.json(),
            filename: "error.log",
            level: "error"
        }),
        new winston.transports.Console({
            format: winston.format.cli(),
            level: process.env.LOG_LEVEL
        })
    ]
});
logger.info("proccess started");

logger.debug("current config: " + JSON.stringify({
    LOG_LEVEL: process.env.LOG_LEVEL,
    LANGUAGE: process.env.LANGUAGE,
    CRON_SCHEDULE: process.env.CRON_SCHEDULE,
    SLACK_ENABLED: process.env.SLACK_ENABLED,
    SLACK_CHANNEL: process.env.SLACK_CHANNEL,
    SLACK_BOT: process.env.SLACK_BOT,
    SLACK_WEBHOOK: "***" + process.env.SLACK_WEBHOOK.slice(-5),
    ENABLE_STATIC_WEB: process.env.ENABLE_STATIC_WEB
}));

const locale = require("./locales/" + process.env.LANGUAGE + ".json");
const t = translations(locale);
const slack = new Slack();
const actionModule = process.argv[2];

logger.debug(
    "the current cron schedule for calling the " + actionModule + " action is: " + process.env.CRON_SCHEDULE
);

slack.setWebhook(process.env.SLACK_WEBHOOK);
var action = require("./actions/" + actionModule + "/index.js");
let job = schedule.scheduleJob(process.env.CRON_SCHEDULE, runJob);
logger.info("first event will fire at: " + job.nextInvocation());

if (process.env.ENABLE_STATIC_WEB === "true") {
    logger.info("static web server enabled");
    const path = require('path');
    const port = process.env.PORT || 80;
    const express = require("express");
    const app = express();
    app.get('*', function (request, response) {
        response.send("Keep alive");
    });
    app.listen(port);
}

function runJob() {
    logger.info("schedule fired on: " + new Date());
    action(logger, t, postToSlack);
    logger.info("next schedule event at: " + job.nextInvocation());
}

function postToSlack(message) {
    logger.info("new message to post: " + message);
    logger.info("posting as " + process.env.SLACK_BOT + " in " + process.env.SLACK_CHANNEL);
    if (process.env.SLACK_ENABLED === "true") {
        logger.info("slack is enabled, posting");
        slack.webhook({
            channel: process.env.SLACK_CHANNEL,
            username: process.env.SLACK_BOT,
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