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
            let textToPost = "";
            if ((textToPost = processDatabase(logger, result)) !== "") {
                logger.info("new instagram post, posting...");
                postToSlack(textToPost);
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
    logger.log("silly", "new data: " + JSON.stringify(newData));
    const database = JSON.parse(databaseFileContent);

    let textToPost = "";
    _.forEach(newData, item => {
        logger.log("silly", "data item: " + JSON.stringify(item));
        const found = _.findLast(database, d => d.description === item.description);
        logger.log("silly", item.description + " -> " + item.link);
        if (found === undefined) {
            logger.info("new post found " + item.description + " | " + item.link);
            textToPost = item.link;
            return false;
        }
    });

    const databaseAsString = JSON.stringify(newData, null, 4);
    logger.log("silly", databaseAsString);
    fs.writeFileSync(databaseFile, databaseAsString);
    return textToPost;
}

/*
    Parsing instagram to get the urls of the images is a little tricky, here we
    parse the html of a public instagram page so we dont have to worry about
    API keys and authentication. In the way the public page is rendered, all
    the posts data are in a _shareData variable in a script, so with a regular
    expression we get that variable from the body (as text) and parse it in a
    javascript variable.
    From there is just findind the posts in the instagram model and cleaning it
    up a bit (for example removing any query parameters to avoid duplicates)

    Posts are currently in:
    _sharedData
        .entry_data
            .ProfilePage[0]
                .graphql
                    .user
                        .edge_owner_to_timeline_media
                            .edges (array of posts)
                                .node
                                    .thumbnail_src (image url)
                                    .edge_media_to_caption
                                        .edges[0]
                                            .node
                                                .text (post description)
*/
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
            if (post.node.edge_media_to_caption.edges.length === 0) {
                return;
            }
            let link = post.node.thumbnail_src;
            if (link.indexOf("?") >= 0) {
                link = link.split("?")[0];
            }
            const desc = post.node.edge_media_to_caption.edges[0].node.text;
            logger.log("silly", `searching for ${process.env.INSTA_FILTER} in ${desc}`);
            if (desc.indexOf(process.env.INSTA_FILTER) > 0) {
                logger.debug("found post: " + link);
                logger.debug(desc);
                posts.push({
                    description: desc,
                    link: link
                });
            }
        });
    }
    return posts;
}