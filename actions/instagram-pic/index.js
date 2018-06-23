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
    const regex = /<script type="text\/javascript">window\._sharedData = (.+);<\/script>/gm;
    let m;
    if ((m = regex.exec(body)) !== null) {
        const scriptData = JSON.parse(m[1]);
        const entryData = scriptData.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges;
        _.forEach(entryData, post => {
            logger.log("silly", JSON.stringify(post));
            const link = post.node.thumbnail_src;
            const desc = post.node.edge_media_to_caption.edges[0].node.text;
            logger.log("silly", `searching for ${process.env.INSTA_FILTER} in ${desc}`);
            if (desc.indexOf(process.env.INSTA_FILTER) > 0) {
                logger.debug("found post: " + link);
                logger.debug(desc);
                posts.push(link);
            }
        });
    }
    return posts;
}