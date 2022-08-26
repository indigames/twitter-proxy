const oauth = require('oauth');
var express = require('express');
var multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const request = require('request');
var http = require('http');
var bodyParser = require('body-parser');
var upload = multer();
var URL = require('url');
const { config } = require('process');
var headerzz = "";
url = require('url');
_ = require('lodash');
oauthSignature = require("oauth-signature");

var oauthCache = null;

/**
 * Constructs an OAuth request object that can then be used with a token and
 * token secret to proxy request to Twitter.
 *
 * Parameters:
 *   {object} client Contains consumerKey & consumerSecret
 */
exports.constructOa = function (client) {
    return new oauth.OAuth(
        'https://api.twitter.com/oauth/request_token',
        'https://api.twitter.com/oauth/access_token',
        client.consumerKey, client.consumerSecret,
        '1.0', null, 'HMAC-SHA1'
    );
};

/**
 * Proxy the request to this API over to Twitter, wrapping it all up in a lovely
 * OAuth1.0A package. The Twitter API credentials are stored in the client
 * object.
 *
 * Parameters:
 *   {string} opts.method  HTTP method, and name of method on the OAuth object
 *   {string} opts.path    Twitter API URL path
 *   {object} opts.config  Keys: accessToken and accessTokenSecret
 *   {object} opts.req     An express request object
 *   {object} opts.client  A document from the client collection, used to
 *                         construct an OAuth request object.
 *   {function} cb         Callback function for when the request is complete.
 *                         Takes an error, the response as a string and the full
 *                         response object.
 */
function proxyRequest(opts, cb) {
    // Pull the oa object from the in-memory cache, or create a new one.
    let oa = oauthCache || exports.constructOa(opts.client);
    oauthCache = oa;

    // Make sure the the oa object has the requisite method
    let method = opts.method.toLowerCase();

    if (!oa[method])
        return cb(new Error("Unknown method"));

    let twitterUrl = url.format({
        protocol: 'https',
        host: 'api.twitter.com',
        pathname: opts.path,
        query: opts.req.query
    });

    oa[method](
        twitterUrl,
        opts.config.accessToken,
        opts.config.accessTokenSecret,
        JSON.stringify(opts.body), 'application/json', cb
    );

};

/**
 * Filter out unwanted information from a headers object.
 */
exports.filterHeaders = function (headers) {
    let reject = ['content-length', 'content-type'];

    return Object.keys(headers).reduce(function (memo, key) {
        if (!_.includes(reject, key))
            memo[key] = headers[key];

        return memo;
    }, {});
};

exports.route = function (app) {
    /**
     * Proxy requests to all other URLs to Twitter, using the same path. It also
     * passes all query parameters, except those used by the proxy, on to Twitter.
     */
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(upload.array());
    app.use(express.static('public'));

//------

app.post('/1.1/media/upload.json', (req, res, next) => {
    let config = app.get('config');
    var targetUrl = "https://upload.twitter.com/1.1/media/upload.json";
    var datas = new FormData();
        datas.append('media_data', req.body.media_data);
        
    var requestOptions = {
        method: 'POST',
        headers:  {
            "Content-Transfer-Encoding" :  "base64",
            "Authorization": _GenerateHeaders(req.body.oauth_token,req.body.oauth_token_secret, targetUrl, 'POST', app)
        },
        body: datas,
        redirect: 'follow'
    };


    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    

    // Request headers you wish to allow
    

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    


    fetch(targetUrl, requestOptions)
    .then(response => response.text())
    .then(result => res.send(result)
        // res.send(JSON.parse(result).media_id_string)
        )
    .catch(error => console.log('error', error));
    
});

app.post('/2/tweets', (req, res, next) => {
    var raw = JSON.stringify({
                "text": req.body.text,
                "media":req.body.media
            });
            var tweetURL = "https://api.twitter.com/2/tweets";
            var Options = {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": _GenerateHeaders(req.body.oauth_token, 
                        req.body.oauth_token_secret, 
                        tweetURL, 'POST', app)
                },
                body: raw,
                redirect: 'follow'
            };
    
            
            fetch(tweetURL, Options)
                .then(response => response.text())
                .then(result => console.log(result))
                .catch(error => console.log('error', error));
    
});

app.post('/oauth/access_token', (req, res, next) => {
   
    var targetUrl = "https://api.twitter.com/oauth/access_token";
    var datas = new FormData();
        datas.append('oauth_verifier', req.body.oauth_verifier);
    var requestOptions = {
        method: 'POST',
        headers:  {
            "Authorization": _GenerateHeaders(req.body.oauth_token, config.accessTokenSecret, targetUrl, 'POST', app),
        },
        body: datas,
        redirect: 'follow'
    };

    fetch(targetUrl, requestOptions)
    .then(response => response.text())
    .then(result => res.send(result)
    
    )
    .catch(error => console.log('error', error));
    

});

app.get('/test', (req, res, next) => {
    console.log('tweets');
    res.send('test');
});


//----

    app.post('/oauth/*?', (req, res, next) => {
        console.log("proxy::oauth::POST");
        let config = app.get('config'),
            proxyConfig = {
                accessToken: config.accessToken,
                accessTokenSecret: config.accessTokenSecret
            },
            client = {
                consumerKey: config.consumerKey,
                consumerSecret: config.consumerSecret
            };

        proxyRequest({
            req: req,
            method: req.method,
            path: req.path,
            body: req.body,
            config: proxyConfig,
            client: client
        }, (oaErr, strData, oaRes) => {
            console.log("proxy::oauth::callback");
            // Merge headers in, but don't overwrite any existing headers
            if (oaRes.headers)
                res.set(_.defaults({}, res._headers, exports.filterHeaders(oaRes.headers)));

            let data = strData;

            // Uh oh, errortime.
            if (oaErr) {
                // Intercept a Twitter error
                data = oaErr.data;

                try {
                    data = JSON.parse(oaErr.data);
                } catch (e) {
                    console.log('oaErr', e);
                }
            }

            // Try to extract JSON data
            try {
                // oauth_token=8stBbQAAAAABfzTSAAABgqXzPOo&oauth_token_secret=wj5cWd96MRLUU5W0PT1deQA4sd9VytEK&oauth_callback_confirmed=true
                var resultObject = {};
                var tokens = strData.split('&');
                for (let index = 0; index < tokens.length; index++) {
                    const token = tokens[index];
                    var [key, content] = token.split('=');
                    resultObject[key] = content;
                }
                res.setHeader('Content-Type', 'application/json');
                res.status(oaRes.statusCode).send(resultObject);
            } catch (e) {
                console.log(e);
            }
        });

    });
    app.all('/*?', function (req, res, next) {
        let config = app.get('config'),
            proxyConfig = {
                accessToken: config.accessToken,
                accessTokenSecret: config.accessTokenSecret
            },
            client = {
                consumerKey: config.consumerKey,
                consumerSecret: config.consumerSecret
            };

        // Prozy the request onward to Twitter. The OAuth parcel is created in
        // proxyRequest, and cached for later.
        // method, path, config, req, client
        proxyRequest({
            req: req,
            method: req.method,
            path: req.path,
            body: req.body,
            config: proxyConfig,
            client: client
        }, (oaErr, strData, oaRes) => {
            // Merge headers in, but don't overwrite any existing headers
            if (oaRes.headers)
                res.set(_.defaults({}, res._headers, exports.filterHeaders(oaRes.headers)));

            let data = strData;

            // Uh oh, errortime.
            if (oaErr) {
                // Intercept a Twitter error
                data = oaErr.data;

                try {
                    data = JSON.parse(oaErr.data);
                } catch (e) {
                    console.log('oaErr', e);
                }
            }

            // Try to extract JSON data
            try {
                // Pass on data with the same the status code
                res.setHeader('Content-Type', 'application/json');
                res.status(oaRes.statusCode).send(JSON.parse(data));
            } catch (e) {
                console.log(e);
            }
        });
    });
};
NONCE_CHARS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
    'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B',
    'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
    '4', '5', '6', '7', '8', '9']
_getNonce = function (nonceSize) {
    var result = [];
    var chars = NONCE_CHARS;
    var char_pos;
    var nonce_chars_length = chars.length;

    for (var i = 0; i < nonceSize; i++) {
        char_pos = Math.floor(Math.random() * nonce_chars_length);
        result[i] = chars[char_pos];
    }
    return result.join('');
};
_encodeData = function (toEncode) {

    var result = encodeURIComponent(toEncode);
    // Fix the mismatch between OAuth's  RFC3986's and Javascript's beliefs in what is right and wrong ;)
    return result.replace(/\!/g, "%21")
        .replace(/\'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");

}



_GenerateHeaders = function (oauth_token, oauth_token_secret, targetUrl, method, app) {

    let config = app.get('config');


    var oauthParameters = {
        "oauth_consumer_key": config.consumerKey,
        "oauth_token": "",
        "oauth_signature_method": 'HMAC-SHA1',
        "oauth_timestamp": Math.floor((new Date()).getTime() / 1000),
        "oauth_nonce": _getNonce(11),
        "oauth_version": '1.0'
    };
    oauthParameters["oauth_token"] = oauth_token;

    var httpMethod = method,
        url = targetUrl,
        parameters = oauthParameters,
        consumerSecret = config.consumerSecret,
        tokenSecret = oauth_token_secret;

    var signatute = oauthSignature.generate(httpMethod, url, parameters, consumerSecret, tokenSecret);



    oauthParameters["oauth_signature"] = signatute;
    var authHeader = "OAuth oauth_consumer_key=" + oauthParameters.oauth_consumer_key +
        ",oauth_nonce=" + oauthParameters.oauth_nonce + ",oauth_signature_method=" + oauthParameters.oauth_signature_method +
        ",oauth_timestamp=" + oauthParameters.oauth_timestamp + ",oauth_token=" + oauthParameters.oauth_token + ",oauth_version=" + oauthParameters.oauth_version + ",oauth_signature="+oauthParameters.oauth_signature;

    return authHeader;

}
