# Slackbot Russia 2018 World Cup

A bot for slack to message about matches of the 2018 FIFA World Cup and other custom actions

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

## Modules
Now you can develop your own modules to make the bot do other things based on actions. The football-data is now a module, so starting the app must include the module. As an example there is another module that parses the web www.coperos.com for a rooster and post the rooster to the channel. To launch the new module the command is (node index.js coperos).
For example you can run the football-data every 10 minutes, the instagram every 30 minutes and the coperos once a day at 23:00:
```
CRON_SCHEDULE="*/10 * * * *" node index.js football-data
INSTA_ACCOUNT=maradona INSTA_FILTER="Copa del Mundo 2018" CRON_SCHEDULE="*/30 * * * *" node index.js instagram-pic
CRON_SCHEDULE="0 23 * * *" node index.js coperos
```
You can also run more than one module in the same call like this:
```
CRON_SCHEDULE="*/10 * * * *" INSTA_ACCOUNT=maradona INSTA_FILTER="Copa del Mundo 2018" node index.js football-data,instagram-pic
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

### Instagram pic module (upgrade from v1.0.0 to v1.1.0 includes a breaking change)
- Scrapes the configured instagram (https://www.instagram.com/{INSTA_ACCOUNT}/) and get images for posts related to the specified filter {INSTA_FILTER}. By default configured to post world cup photos from the @maradona account
- Post the scrapped images to slack
- Migration from v1.0.0 to v1.1.0 (new database format)
    - If the app was never run, there are no issues
    - If the app was run before, delete the old database
    - Start the process with the SLACK_ENABLED set to false to prevent multiple post to slack  `SLACK_ENABLED=false node index.js instagram-pic`
    - (a new db with the proper structure will be created)
    - Run the app normally to continue using it as usual

## Configs
All configurations can be modified by environmental variables, or using the .env file. Here are the different configurations available:

### General
- MODULES - type: string array, default `"football-data"`, The modules to run separated by , (if the modules are passed by argument it will override this option) 
- LOG_LEVEL - type: string, default `"info"`, The log level to the console (error, info, debug, silly, etc...)
- LANGUAGE - type: string, default: `"en"`, Language for the translations, the "es" language is already included, any new language should be added as a new file in the locales folder following the convention of the other files already there.
- CRON_SCHEDULE, type: string (cron expression), default: `"*/15 * * * *"`, The cron expression to schedule each Api check, see https://es.wikipedia.org/wiki/Cron_(Unix)
- SLACK_ENABLED, type: boolean, default: `true`, Enable or disable the post to slack, good for testing the configuration.
- SLACK_CHANNEL, type: string, default: `"#worldcup"`, The name of the slack channel that the bot will post to.
- SLACK_BOT, type: string, default: `"Worldcup"`, The name of the bot (configured in slack) that will make the post.
- SLACK_WEBHOOK, type string, default: `"https://hooks.slack.com/services/***`, The slack webhook url, the default will not work, you need to get this from slack when creating the webhook.
- ENABLE_STATIC_WEB, type boolean, default: `false`, Enable a static web server that serves logs, helpful for heroku, enabled in the heroku app by default.

### Football-data module
- HIGHLIGHTED_TEAM - type: string, default: `"Argentina"`, A team to highligh (bold) in the posted message, it should match the team name that comes from the Api.
- SHOW_ZONES_JSON, type: json, default: `'{ "ART": "-3", "IST": "+1" }'`, A key-value object that represent the available timezones where the match time will be shown, the key could be anything (preferably a timezone name), the value should be the integer offset hours of the timezone.
- FOOTBALL_DATA_API_TOKEN, type string, default: `"***"`, The Api token used to get the match data, the default will not work, you need to get this from the Api page.

### Coperos module
- COPEROS_TOURNAMENT, type string, default: `"rusia_2018_1.html"`, The url of the www.coperos.com tournament to get the rooster.

### Instagram pic module
- INSTA_ACCOUNT, type string, default: `"maradona"`, The instagram account (should be public) to scrape images.
- INSTA_FILTER, type string, default: `"Copa del Mundo 2018"`, A filter string to only post images that in the description contains that string.

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
5. :sob: user5 (0 pts.)
```

### Instagram pic module
Picture of an instagram post

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
    let message = t("Love this {lovableItem} :robot_face:", {lovableItem: process.env.LOVABLE_ITEM});
    // postToSlack(message) will post whaever message you pass to the configured slack
    // channel, it support all the emojis and rich text supported by slack.
    postToSlack(message);
}
```
- If you need configurations you can use the env variables, any variable in the .env file will also be loaded
- Run it (this will post "Love this bot :robot_face:" every half hour to slack):
```
LOVABLE_ITEM=bot SLACK_WEBHOOK="https://hooks.slack.com/services/MYSLACKWE/BHOOKKEYTHA/tIgotFROMslackWebInterface" CRON_SCHEDULE="*/30 * * * *" node index.js my-module
```
