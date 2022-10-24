const puppeteerVanilla = require('puppeteer');
const { addExtra } = require('puppeteer-extra');
const puppeteer = addExtra(puppeteerVanilla);
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const jsdom = require("jsdom");
const {sleep, logMessage} = require('./utils');
require('dotenv').config();
let Twitter = require('twitter');


puppeteer.use(StealthPlugin())

let latestDate = "";
let baseURL = "https://app.degods.com/pow";
let twitterClient = new Twitter({
    consumer_key: process.env.bot_consumer_key,
    consumer_secret: process.env.bot_consumer_secret,
    access_token_key: process.env.bot_access_token_key,
    access_token_secret: process.env.bot_access_token_secret
});


let getPOWsource = async function () {
    let browser, page;
    try {
        browser = await puppeteer.launch({
            ignoreHTTPSErrors: true, headless: true, args: ['--window-size=1920,1080', '--no-sandbox']
        });
        
        page = (await browser.pages())[0];
        
        const headlessUserAgent = await page.evaluate(() => navigator.userAgent);
        const chromeUserAgent = headlessUserAgent.replace('HeadlessChrome', 'Chrome');
        await page.setUserAgent(chromeUserAgent);
        await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.8'
        });
    }
    catch (e) {
        logMessage("Error staring browser: " + e);
        return {page: page, browser: browser};
    }
    try {
        await page.goto(baseURL, {waitUntil: "networkidle2"});
        await sleep(1500);
    
        return {page: page, browser: browser};
    }
    catch (e) {
        logMessage("Error navigating to page: " + e);
        return {page: page, browser: browser};
    }

}

let getLatestNews = async function (page, browser) {
    let dom, currentDate;

    try {
        let source = await page.content();
        dom = new jsdom.JSDOM(source);
        let headings = dom.window.document.querySelectorAll("h1");
                
        for (head of headings) {
            if (head.textContent.endsWith("2022")) {
                currentDate = head.textContent.toString();
                break;
            }
        }
    }
    catch (e) {
        logMessage("Error getting curret date: " + e);
        return {date: currentDate, allNews: []};
    }

    try {
        let allParagraphs = dom.window.document.querySelectorAll("p");

        // Iterate over all paragraphs and find the one that contains •
        let news;
        for (let i = 0; i < allParagraphs.length; i++) {
            if (allParagraphs[i].textContent.includes("•")) {
                news = allParagraphs[i].textContent;
            }
        }
    
        news = news.split("\n")
        news = news.map(news => news.replace("\n", ""))
    
        let newsObject = {
            date: currentDate,
            allNews: news
        }
    
        await browser.close();
    
        return newsObject;
    }
    
    catch (e) {
        logMessage("Error getting news: " + e);
        return {date: currentDate, allNews: []};
    }
}

const postTweet = async function (newsObject) {
    let tweet;
    try {
        const MAX_LENGTH = 280;

        let prefix = "New POW news for " + newsObject.date + ":" + "\n\n";
        let suffix = "\n...\n\n" + "Full News: " + baseURL;
        let addedNewsLen = 0;
        let addedNews = [];

        for (let i = 0; i < newsObject.allNews.length; i++) {
            let news = newsObject.allNews[i];
            if (prefix.length + suffix.length + addedNewsLen + news.length + 1 < MAX_LENGTH) {
                addedNewsLen += news.length + 1;
                addedNews.push(news);
            }   
        }

        tweet = prefix + addedNews.join("\n") + suffix;
    }
    catch (e) {
        logMessage("Error while creating tweet: " + e);
        return;
    }

    try {
        let status = {
            status: tweet,
        }
        
        await twitterClient.post('statuses/update', status);
    }
    catch (e) {
        logMessage("Error while posting tweet: " + e);
        return;
    }
}


let init = async function () {
    let session = await getPOWsource();
    let newsObject = await getLatestNews(session.page, session.browser);
    latestDate = newsObject.date;
}

let main = async function () {
    logMessage("Starting bot");
    
    try {
        await init();
    }
    catch (err) {
        logMessage("Bot startup failed with error: " + err);
        process.exit(1);
    }
    
    logMessage("Initialized");
    logMessage("Latest date: " + latestDate);
    logMessage("Starting loop");

    // latestDate = -1;

    while (true) {
        await sleep(1000 * 60 * 3);
        logMessage("Checking for new news");
        let session;
        let newsObject;

        try {
            session = await getPOWsource();
            newsObject = await getLatestNews(session.page, session.browser);    
        }
        catch (e) {
            logMessage("Error: " + e);
            continue;
        }

        if (newsObject.date !== latestDate) {
            logMessage("New news found -> " + newsObject.date);
            logMessage("Posting tweet...");
            await postTweet(newsObject);
            logMessage("Tweet posted");
            latestDate = newsObject.date;
        }
        else {
            logMessage("No new news found");
        }
    }
}

main();