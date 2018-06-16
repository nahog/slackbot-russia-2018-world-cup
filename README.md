# Slackbot Russia 2018 World Cup

A bot for slack to message about matches of the 2018 FIFA World Cup and other custom actions

## Modules (NEW!)
Now you can develop your own modules to make the bot do other things based on actions. The football-data is now a module, so starting the app must include the module. As an example there is another module that parses the web www.coperos.com for a rooster and post the rooster to the channel. To launch the new module the command is (node index.js coperos).
For example you can run the football-data every 10 minutes and the coperos once a day at 23:00:
```
CRON_SCHEDULE="*/10 * * * *" node index.js football-data
CRON_SCHEDULE="0 23 * * *" node index.js coperos
```

## What you have to do
- Configure the slack webhook https://api.slack.com/incoming-webhooks
- Run the app somewhere (node index.js football-data)

### Football-data module extra
- Get an api token from https://api.football-data.org/client/register

## What it does for you

### Football-data module
- Post every day, the matches of the day
- Updates for new goals on each match
- Highlight your preferred team
- Supports multiple languages
- Supports multiple timezones
- Uses flag emoticons

### Coperos module
- Scrapes the www.coperos.com/torneos/your-tourament url
- Post the current rooster extracted from the site

## Configs
All configurations can be modified by environmental variables, or using the config.json file. There is one general config, and one in each module, for security reasons the config.json file is ignored in git but an example config file is provided for easy ussage. Here are the different configurations available:

### General
- LOG_LEVEL - type: string, default `"info"`, The log level to the console (error, info, debug, silly, etc...)
- LANGUAGE - type: string, default: `"en"`, Language for the translations, the "es" language is already included, any new language should be added as a new file in the locales folder following the convention of the other files already there.
- CRON_SCHEDULE, type: string (cron expression), default: `"*/15 * * * *"`, The cron expression to schedule each Api check, see https://es.wikipedia.org/wiki/Cron_(Unix)
- SLACK_ENABLED, type: boolean, default: `true`, Enable or disable the post to slack, good for testing the configuration.
- SLACK_CHANNEL, type: string, default: `"#worldcup"`, The name of the slack channel that the bot will post to.
- SLACK_BOT, type: string, default: `"Worldcup"`, The name of the bot (configured in slack) that will make the post.
- SLACK_WEBHOOK, type string, default: `"https://hooks.slack.com/services/***`, The slack webhook url, the default will not work, you need to get this from slack when creating the webhook.

### Football-data module
- HIGHLIGHTED_TEAM - type: string, default: `"Argentina"`, A team to highligh (bold) in the posted message, it should match the team name that comes from the Api.
- SHOW_ZONES_JSON, type: json, default: `'{ "ART": "-3", "IST": "+1" }'`, A key-value object that represent the available timezones where the match time will be shown, the key could be anything (preferably a timezone name), the value should be the integer offset hours of the timezone.
- FOOTBALL_DATA_API_TOKEN, type string, default: `"***"`, The Api token used to get the match data, the default will not work, you need to get this from the Api page.

### Coperos module
- COPEROS_TOURNAMENT, type string, default: `"rusia_2018_1.html"`, The url of the www.coperos.com tournament to get the rooster.

## Sample post

### Football-data module
```
Today's match Egypt :flag-eg: vs :flag-uy: Uruguay at 9:00 AM ART, 1:00 PM IST
```

### Coperos module
```
Current www.coperos.com :soccer: rooster:
1. :first_place_medal: user1 (3 pts.)
2. :second_place_medal: user2 (3 pts.)
3. :third_place_medal: user3 (3 pts.)
4. user4 (3 pts.)
5. user5 (3 pts.)
6. user6 (3 pts.)
7. user7 (0 pts.)
8. :sob: user8 (0 pts.)
```

## Screenshots
- ![](servers.jpg?raw=true)
- ![](slack.jpg?raw=true)

## For developers
To add a new module you can base your code in one of the football-data or coperos module, but the gist is this:
- Create an index.js file inside the actions/your-module folder (i.e. actions/my-module/index.js)
- Implement the module export as follows:
```javascript
module.exports = function(logger, t, postToSlack) {
    // Do your stuff here, this function will be called by the cron based on the
    // cron expression config.
    // logger lets you log commands to the cli using winston (i.e. logger.info("..."),
    // logger.error("...")).
    logger.info("executing my custom module");
    // t() lets you use the translations in the locale folder (you will need to add your
    // strings there if you want to support localization in your module). See the
    // node-translations pkg, or you can simple does not use t() and have a single
    // language in your module
    let message = t("Love this {lovableItem} :robot_face:", {lovableItem: "bot"});
    // postToSlack(message) will post whaever message you pass to the configured slack
    // channel, it support all the emojis and rich text supported by slack.
    postToSlack(message);
}
```
- If you need configurations you can use constants or config files and require them to keep the same pattern as other modules
```javascript
require("./config.json");
const myConfig = process.env.MY_MODULE_MY_CONFIG || config.myConfig || "default";
```
- Run it (this will post "Love this bot :robot_face:" every half hour to slack):
```
SLACK_WEBHOOK="https://hooks.slack.com/services/MYSLACKWE/BHOOKKEYTHA/tIgotFROMslackWebInterface" CRON_SCHEDULE="*/30 * * * *" node index.js my-module
```

## Todos
- A lot, it was some quick and dirty code made the morning before the world cup start, enjoy the **World Cup**
