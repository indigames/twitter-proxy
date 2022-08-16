#!/usr/bin/env node

const path = require('path');

// Grab the config file
let configPath = process.argv[2] || path.join(process.cwd(), './config.json');
// using env config by default
let config = {
    consumerKey: process.env.CONSUMER_KEY,
    consumerSecret: process.env.CONSUMER_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    port: process.env.PORT
};

try {
    config = require(configPath);
} catch (e) {
    console.warn(`Incompatible or nonexistent config file at ${configPath}`);
    console.warn(e);
    console.info('Fall back to use env variables.');
}

const { consumerKey, consumerSecret } = config;
if (!consumerKey || !consumerSecret) {
    console.error('Envinronments variables is undefined.');
    process.exit(1);
}

require('./server')(config);