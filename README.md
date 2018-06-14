# Slackbot Russia 2018 World Cup

A bot for slack to message about matches of the 2018 FIFA World Cup

## What you have to do
- Configure the slack webhook https://api.slack.com/incoming-webhooks
- Get an api token from https://api.football-data.org/client/register
- Run the app somewhere (node index.js football-data)

## Modules (NEW!)
Now you can develop your own modules to make the bot do other things based on actions. The football-data is now a module, so starting the app must include the module. As an example there is another module now, that parse the web www.coperos.com for a rooster and post the rooster to the channel. To launch the new module the command is (node index.js coperos).
For example you can run the football-data every 15 minutes and the coperos once a day
```
CRON_SCHEDULE="*/10 * * * *" node index.js football-data
CRON_SCHEDULE="0 23 * * *" node index.js coperos
```

## What it does for you
- Post every day, the matches of the day
- Updates for new goals on each match
- Highlight your preferred team
- Supports multiple languages
- Supports multiple timezones
- Uses flag emoticons

## Configs
All configurations can be modified by environmental variables, here are the different configurations available:

### General
- LOG_LEVEL - type: string, default `"debug"`, The log level to the console (error, info, debug, silly, etc...)
- LANGUAGE - type: string, default: `"en"`, Language for the translations, the "es" language is already included, any new language should be added as a new file in the locales folder following the convention of the other files already there.
- CRON_SCHEDULE, type: string (cron expression), default: `"*/10 * * * *"`, The cron expression to schedule each Api check, see https://es.wikipedia.org/wiki/Cron_(Unix)
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
`Nueva actualizacion para Rusia :flag-ru: vs :flag-sa: Arabia Saudita, Rusia :flag-ru: 5 - 0 :flag-sa: Arabia Saudita`

## Todos
- A lot, it was some quick and dirty code made the morning before the world cup start, enjoy the **World Cup**
