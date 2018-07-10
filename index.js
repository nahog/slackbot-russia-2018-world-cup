const translations = require("translations");
const schedule = require("node-schedule");
const Slack = require("slack-node");
const winston = require("winston");
const path = require("path");
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
    MODULES: process.env.MODULES,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LANGUAGE: process.env.LANGUAGE,
    CRON_SCHEDULE: process.env.CRON_SCHEDULE,
    SLACK_ENABLED: process.env.SLACK_ENABLED,
    SLACK_CHANNEL: process.env.SLACK_CHANNEL,
    SLACK_BOT: process.env.SLACK_BOT,
    SLACK_WEBHOOK: "***" + process.env.SLACK_WEBHOOK.slice(-5),
    ENABLE_STATIC_WEB: process.env.ENABLE_STATIC_WEB
}));

if (!fs.lstatSync("./locales").isDirectory()) {
    logger.error("no locales directory");
    return 1;
}
if (!fs.existsSync("./locales/" + process.env.LANGUAGE + ".json")) {
    logger.error("no locales .json file, expecting locale: " + process.env.LANGUAGE);
    return 1;
}
if (!fs.lstatSync("./actions").isDirectory()) {
    logger.error("no actions directory");
    return 1;
}

const actionsDir = path.resolve(__dirname, "actions");
const availableModules = fs.readdirSync(actionsDir).filter(f => fs.statSync(path.join(actionsDir, f)).isDirectory());
if (availableModules.length < 1) {
    logger.error("no modules available");
    return 1;
}

const locale = require("./locales/" + process.env.LANGUAGE + ".json");
const t = translations(locale);
const slack = new Slack();

let actionModules = [];
if (process.argv.length === 2) {
    logger.info("no modules passed as arguments, getting modules from config")
    actionModules = process.env.MODULES.split(",");
}
if (process.argv.length === 3) {
    logger.info("modules passed as arguments")
    actionModules = process.argv[2].split(",");
}

if (actionModules.length === 0 ) {
    logger.error("wrong arguments, use: node index.js module1,module2 or set the MODULES env variable if you dont wish to pass it as arguments");
    return 1;
}

const modulesNotAvailable = actionModules.filter(mod => {
    return availableModules.indexOf(mod) < 0;
});
if (modulesNotAvailable.length !== 0) {
    logger.error("no modules found for " + modulesNotAvailable.join(",") + " available modules are " + availableModules.join(","));
    return 1;
}

logger.debug(
    "the current cron schedule for calling the " + actionModules.join(",") + " actions is: " + process.env.CRON_SCHEDULE
);

slack.setWebhook(process.env.SLACK_WEBHOOK);
let actions = [];
actionModules.forEach(actionModule => {
    actions.push(require("./actions/" + actionModule + "/index.js"));
});
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
    actions.forEach(action => {
        action(logger, t, postToSlack);
    });
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