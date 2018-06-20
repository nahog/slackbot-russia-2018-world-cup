const request = require('request');
const cheerio = require('cheerio');
const _ = require('lodash');
const fs = require('fs');

const databaseFile = `insta-${process.env.INSTA_ACCOUNT}.json`;
const scrapUrl = `https://www.instagram.com/${process.env.INSTA_ACCOUNT}/`;

module.exports = function (logger, t, postToSlack) {
    logger.debug("current config: " + JSON.stringify({
        INSTA_ACCOUNT: process.env.INSTA_ACCOUNT,
        INSTA_FILTER: process.env.INSTA_FILTER
    }));
    logger.debug("database name: " + databaseFile);
    logger.debug("scrap url: " + scrapUrl);

    if (!fs.existsSync(databaseFile)) {
        fs.writeFileSync(databaseFile, '[]');
    }
    request(scrapUrl, function (error, response, html) {
        if (!error && response.statusCode == 200) {
            let $ = cheerio.load(html);
            let result = getWorldCupPosts(logger, $);

            logger.log("silly", JSON.stringify(result));
            if (processDatabase(logger, result)) {
                logger.info("new instagram post, posting...");
                if (result.length > 0) {
                    postToSlack(result[0]);
                }
            } else {
                logger.info("no new post");
            }
        }
    });
}

function processDatabase(logger, newData) {
    if (!fs.existsSync(databaseFile)) {
        logger.info("no database, creating new one");
        fs.writeFileSync(databaseFile, "[]");
    }

    const databaseFileContent = fs.readFileSync(databaseFile);
    logger.log("silly", "database data: " + databaseFileContent);
    const database = JSON.parse(databaseFileContent);

    let changed = false;
    _.forEach(newData, item => {
        const found = _.findLast(database, d => d === item);
        logger.log("silly", item + " -> " + found);
        if (found === undefined) {
            logger.info("new post found " + item);
            changed = true;
            return false;
        }
    });

    const databaseAsString = JSON.stringify(newData, null, 4);
    logger.log("silly", databaseAsString);
    fs.writeFileSync(databaseFile, databaseAsString);
    return changed;
}

function getWorldCupPosts(logger, $) {
    let posts = [];
    const body = $("body").html();
    const regex = /{"src":"([^"]*)","config_width":(\d*),"config_height":(\d*)}\],"is_video":(false|true),"should_log_client_event":(false|true),"tracking_token":"([^"]*)","edge_media_to_tagged_user":{"edges":\[\]},"edge_media_to_caption":{"edges":\[{"node":{"text":"([^"]*)"}}\]},"shortcode":"([^"]*)"/gm
    let m;
    while ((m = regex.exec(body)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        const link = m[1];
        const desc = m[7];
        logger.log("silly", `searching for ${process.env.INSTA_FILTER} in ${desc}`);
        if (desc.indexOf(process.env.INSTA_FILTER) > 0) {
            logger.debug("found post: " + link);
            logger.debug(desc);
            posts.push(link);
        }
    }
    return posts;
}