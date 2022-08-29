'use strict';

module.exports = function startTwitterProxyServer(config) {
    /**
     * Setup the server
     */
    let express = require('express'),
        compression = require('compression'),
        morgan = require('morgan'),
        cors = require('cors'),
        http = require('http'),
        app = express();
        var bodyParser = require('body-parser');
    let proxy = require('./proxy');

    // using env config by default
    if (!config) {
        config = {
            consumerKey: process.env.CONSUMER_KEY,
            consumerSecret: process.env.CONSUMER_SECRET,
            accessToken: process.env.ACCESS_TOKEN,
            accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
            port: process.env.PORT
        };
    }

    // Save the config for use later
    app.set('config', config);
    // All environments
    app.set('port', process.env.PORT || 7890);
    // Logging
    app.use(morgan('dev'));
    // gzip
    app.use(compression());
    // Body parsing
    app.use(express.json({limit: '200mb'}));
    app.use(bodyParser.urlencoded({limit: '200mb', extended: true}));
    // CORS
    app.use(cors({
        origin: '*'
    }))

    // Set up the routes
    proxy.route(app);

    /**
     * Get the party started
     */
    http.createServer(app)
        .listen(app.get('port'), function () {
            console.log('twitter-proxy server ready: http://localhost:' + app.get('port'));
        });
};