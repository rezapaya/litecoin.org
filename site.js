//
// Copyright (c) 2013 Litecoin Developers
//
// Miniature ExpressJS+EJS based web server
//

var os = require('os'),
    exec = require('child_process').exec,
    express = require('express'),
    http = require('http'),
    https = require('https'),
    _ = require('underscore');

var _DEBUG = false;
var HTTP_PORT = _DEBUG ? 8080 : 80;
var ENABLE_CACHE = os.hostname() == "sif" ? true : false;

var languages = {
    'en' : 'English',
    'fr' : 'Français',
    'es' : 'Español',
    'pt' : 'Português',
    'it' : 'Italiano',
    'de' : 'Deutsch',
    'nl' : 'Nederlands',
    'el' : 'Ελληνικά',
    'ru' : 'Русский',
    'zh_HANS' : '中文',
    'zh_HANT' : '繁體中文',
    'ja' : '日本語',
}

function dpc(t,fn) { if(typeof(t) == 'function') setTimeout(t,0); else setTimeout(fn,t); }

function Application() {
    var self = this;

    var cache = { }

    var app = express();

    app.configure(function(){
        app.use(express.bodyParser());
        app.set('view engine','ejs');
        app.set('view options', { layout : false });
        // app.use(express.staticCache({ maxObjects : 32, maxLength : 1024 }));

        // allow images to be cached
        app.use('/images/', express.static('http/images/'));

        // override cache settings for other resources
        app.use(function(req, res, next) {
            res.header("Cache-Control", "no-cache, no-store, must-revalidate");
            res.header("Pragma", "no-cache");
            res.header("Expires", 0);
            next();        
        })
        app.use(express.static('http/'));
        app.use('/downloads',express.static('downloads/'));
        app.use(app.router);
    });

    app.get('/upgrade', function(req, res) {
        res.redirect("https://forum.litecoin.net/index.php/topic,4615.msg33170.html");
    });

    app.get('/', function(req, res, next) {
        res.header("Content-Language", "en");

        if(_DEBUG)
            res.render('index.ejs', { self : self, languages : languages, locale : 'en' });
        else
            res.render('index.ejs', { self : self, languages : languages, locale : 'en' }, function(err, html) {
                if(err) {
                    res.end("<meta http-equiv=\"refresh\" content=\"2\">");
                    process.exit(1);
                }

                res.end(html);
            });
    });

    var lang = [ ]
    _.each(languages, function(title, locale_code) {
        lang.push(locale_code);
    })

    function digest_language_handler() {
        var locale_code = lang.shift();
        if(!locale_code)
            return init();
        
        console.log("locale: "+locale_code);
        app.get("/"+locale_code, function(req, res) {
            res.header("Content-Language", locale_code);

            // if ENABLE_CACHE is set to true, we pre-render pages based
            // on locale into cache. After that, pages are served without 
            // EJS rendering. This, however, requires server restart
            // if any content has been modified

            if(ENABLE_CACHE && cache[locale_code])
                return res.end(cache[locale_code]);

            if(_DEBUG)
                res.render('index.ejs', { self : self, languages : languages, locale : locale_code });
            else
                res.render('index.ejs', { self : self, languages : languages, locale : locale_code }, function(err, html) {
                    if(err) {
                        res.end(err);
                        process.exit(1);
                    }
                    cache[locale_code] = html;
                    res.end(html);
                });
        })

        dpc(digest_language_handler);
    }

    function init() {

        app.get('/robots.txt', function(req, res) {
            res.end("Sitemap: http://litecoin.org/sitemap.xml");
        })

        app.get('/sitemap.xml', function(req, res) {
            res.contentType('text/xml');
            var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
            _.each(languages, function(l1, code) {
                xml += '<url>\n<loc>http://litecoin.org' 
                    + (code == 'en' ? '' : '/'+code) 
                    + '</loc>\n';
                _.each(languages, function(l2, target) {
                    if(target != code)
                        xml += '\t<xhtml:link rel="alternate" hreflang="'
                            + target +'" href="http://litecoin.org'
                            + (target == 'en' ? '' : '/'+target) +'" />\n';
                })
                xml += '</url>\n';
            })
            xml += '</urlset>';
            res.end(xml);
        })

        app.get('*', function(req, res){
            res.render('404.ejs', { self : self }, function(err, html) {
                if(err)
                    res.send(err, 404);
                res.send(html, 404);
            });
        });

        console.log("HTTP server listening on port: ",HTTP_PORT);
        http.createServer(app).listen(HTTP_PORT, function() {
            secure();
        });
    }

    function secure() {
        if(process.platform != 'win32') {
            try {
                exec('id -u litecoin', function(err, stdout, stderr) {
                    if(!err) {
                        var uid = parseInt(stdout);
                        if(uid) {
                            console.log('Setting process UID to:',uid);
                            process.setuid(uid);
                        }
                    }
                });
            } catch(ex) {
                console.error(ex);
            }
        }
    }

    digest_language_handler();
}

GLOBAL.app = new Application();

// temporary fix for a problem with file handle accumulation
setInterval(function(){ process.exit(0); }, 1000 * 60 * 60 * 24);
