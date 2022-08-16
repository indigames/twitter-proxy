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
    let proxy = require('./proxy');

    // Save the config for use later
    app.set('config', config);
    // All environments
    app.set('port', config.port || 7890);
    // Logging
    app.use(morgan('dev'));
    // gzip
    app.use(compression());
    // Body parsing
    app.use(express.json());
    app.use(express.urlencoded());
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