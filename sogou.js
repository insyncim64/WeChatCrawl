/*eslint strict:0*/
/*global CasperError, console, phantom, require*/
var x = require('casper').selectXPath;
var fs = require('fs');
var casper = require("casper").create({
    pageSettings: {
        loadImages: false,        // do not load images
        loadPlugins: false         // do not load NPAPI plugins (Flash, Silverlight, ...)
    },
    waitTimeout: 30000
    ,
    verbose: true,
    logLevel: "debug"
});
var baseURL = "http://weixin.sogou.com";
var queryURL = "http://weixin.sogou.com/weixin?type=1&query=%E4%B8%AD%E5%8E%9F%E5%A4%A7%E5%92%96&ie=utf8";
casper.userAgent("Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36");
// The base links array
var queryLinks = [
    queryURL
];

var publicAccountLinks = [];
var articleLinks = [];
var cookies = [];
// If we don't set a limit, it could go on forever
// var cookies = ~~casper.cli.get(0) || "";
var upTo = ~~casper.cli.get(0) || 200;
var queryWord = ~~casper.cli.get(1) || "";
var currentLink = 0;
var cookiesIndex = 0;
var conditionFailed = false;

// Get the links, and add them to the links array
// (It could be done all in one step, but it is intentionally splitted)
function process(link) {
    this.then(function () {
        this.echo('--- addLinks start ' + currentLink + ' : ---' + link);
        if ((/^http:\/\/weixin\.sogou\.com\/weixin.*/i).test(link)) {
            var found = [];
            this.echo("looking for : " + link);
            found = this.evaluate(searchPublicAccountLinks);
            var fullURLs = [];
            found.forEach(function (element) {
                this.echo("link: " + element);
                var queryString = element.replace("gzh", "gzhjs");
                fullURLs.push(baseURL + queryString);
            }, this);
            this.echo(fullURLs.length + " links found on " + link);
            queryLinks = queryLinks.concat(fullURLs);
        } else if ((/^http:\/\/weixin\.sogou\.com\/gzhjs\?.*/i).test(link)) {
            this.echo("Parsing start : " + performance.now());
            var json = this.evaluate(getBody);
            if (json && json.page) {
                if (json.page == 1) {
                    this.echo(json.totalItems);
                    this.echo(json.totalPages);
                    this.echo(json.page);
                    this.echo(link);
                    for (var index = 2; index <= json.totalPages; index++) {
                        var newPageURL = link;
                        if (newPageURL.indexOf("&page=") > -1) {
                            newPageURL = newPageURL.replace(/page=[0-9]*/i, "page=" + index);
                        } else {
                            newPageURL = newPageURL + "&page=" + index;
                        }
                        this.echo("Added query link : " + newPageURL);
                        queryLinks.push(newPageURL);
                    }
                    this.echo("Added page links : " + queryLinks.length);
                }
                var items = json.items;
                items.forEach(function (element) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(element, "text/xml");
                    var filter, map;
                    filter = Array.prototype.filter;
                    map = Array.prototype.map;
                    var urls = map.call(doc.querySelectorAll('url'), function (a) {
                        return a.textContent;
                    });
                    var allURLs = [];
                    urls.forEach(function (childElement) {
                        this.echo("link: " + childElement);
                        allURLs.push(baseURL + childElement);
                    }, this);
                    queryLinks = queryLinks.concat(allURLs);
                }, this);

                this.echo("------------ " + queryLinks.length + " links ------------- ");
            } else {
                this.echo(" ---------- wrong ----------- ");
            }
            this.echo("Parsing end : " + performance.now());
            //start to pull all xml from here
        } else {
            this.echo("Writing start : " + performance.now());
            fs.write(Date.now() + ".html", casper.getHTML(), 'w');
            this.echo("Writing end : " + performance.now());
        }
        this.echo('--- addLinks ended ' + currentLink + ' : ---');
    });
}

// Fetch all <div> elements from the page and return
// the ones which contains a href starting with 'http://'
function searchPublicAccountLinks() {
    var filter, map;
    filter = Array.prototype.filter;
    map = Array.prototype.map;
    return map.call(filter.call(document.querySelectorAll("div"), function (a) {
        return (/^\/.*/i).test(a.getAttribute("href"));
    }), function (a) {
        return a.getAttribute("href");
    });
}

function getBody() {
    var selector = document.querySelector("body");
    if (selector) {
        var bodyContent = selector.textContent;
        var json = JSON.parse(bodyContent);
        return json;
    } else {
        return "";
    }
}

function wait() {
    this.wait(5000, function () {
        this.echo("----- wake up ----");
    })
}

// Just opens the page and prints the title
function start(link) {
    this.start(link, function () {
        this.echo('Page title: ' + this.getTitle());
    });
}

// As long as it has a next link, and is under the maximum limit, will keep running
function check() {
    this.echo('--- Check Start ' + currentLink + ' : ---');
    if (queryLinks[currentLink] && currentLink < upTo) {
        this.echo('--- Link Start ' + currentLink + ' : ---' + queryLinks[currentLink]);
        start.call(this, queryLinks[currentLink]);
        process.call(this, queryLinks[currentLink]);
        wait.call(this);
        changeCookies.call(this);
        currentLink++;
        this.run(check);
        this.echo('--- run ended ' + currentLink + ' : ---');
        this.echo('--- Link End : ' + performance.now() + " : ------- " + currentLink + ' : ---' + queryLinks[currentLink]);
    } else {
        this.echo("All done." + performance.now());
        this.exit();
    }
}

function changeCookies() {
    this.then(function () {
        // if (currentLink % 5 == 1) {
        //     this.echo("Cookies index : " + cookiesIndex % cookies.length);
        //     var cookie = cookies[cookiesIndex % cookies.length];
        //     phantom.clearCookies();
        //     cookie.split(";").forEach(function (pair) {
        //         pair = pair.split("=");
        //         phantom.addCookie({
        //             'name': pair[0],
        //             'value': pair[1],
        //             'domain': 'weixin.sogou.com'
        //         });
        //     });
        //     cookiesIndex++;
        // }
    });
}

casper.start().then(function () {
    this.echo("Starting");
    // var cookies1 = "CXID=53A9B581DF7B6D0050BC4F8B1EC09B39; SUID=66CB5B5F142D900A55FDBB27000C314C; SUV=005C203353F85360560D19ECCDE78021; IPLOC=DE; ad=jkllllllll2QeAbTlllllVbpJe6lllllgCsahkllllwlllll9klll5@@@@@@@@@@; ABTEST=0|1455992068|v1; SNUID=D0D141451A1E372C8913F6D11BB10736; sct=3; weixinIndexVisited=1; ppinf=5|1456074699|1457284299|Y2xpZW50aWQ6NDoyMDE3fGNydDoxMDoxNDU2MDc0Njk5fHJlZm5pY2s6MTA6c3luY19pbiUzQXx0cnVzdDoxOjF8dXNlcmlkOjQ0OkY2OUVGM0RBMkRDMDFFMjlDMDczRUYyMTAxMUUyRDY1QHFxLnNvaHUuY29tfHVuaXFuYW1lOjEwOnN5bmNfaW4lM0F8; pprdig=VGpxPXYfxkMeVK_rOHKNzvZemOeMyIm3x8Da8JDu1o2X6LXh-do_1qnkV2zE72sUiwLm6j97CAOTY8LzM2ZvDZoVrr8slbUxaHCLrf4YQaXl4KCrS9Bg_MiXpADdbLqUhT1OzU9EU84K1tcAzfpOFq1xs9lNJw_tWCNRNXmr_e8;ppmdig=145607470100000018dda75af741e74f8477df07bbdef11a";
    // var cookies2 = "ABTEST=7|1456080711|v1; SNUID=979505015D5B72126BCE6D345EAB77CD; IPLOC=DE; SUID=CACB5B5F2708930A0000000056CA0747; SUID=CACB5B5F5EC90D0A0000000056CA0750; SUV=1456080730050851";
    // var cookies3 = "CXID=53A9B581DF7B6D0050BC4F8B1EC09B39; SUID=66CB5B5F142D900A55FDBB27000C314C; SUV=005C203353F85360560D19ECCDE78021; IPLOC=DE; ad=jkllllllll2QeAbTlllllVbpJe6lllllgCsahkllllwlllll9klll5@@@@@@@@@@; ABTEST=0|1455992068|v1; SNUID=D0D141451A1E372C8913F6D11BB10736; sct=3; weixinIndexVisited=1; PHPSESSID=3r0jqh4d3ada27crj1bvhlhl93; SUIR=D0D141451A1E372C8913F6D11BB10736; ppinf=5|1456079805|1457289405|Y2xpZW50aWQ6NDoyMDE3fGNydDoxMDoxNDU2MDc5ODA1fHJlZm5pY2s6MTA6c3luY19pbiUzQXx0cnVzdDoxOjF8dXNlcmlkOjQ0OkY2OUVGM0RBMkRDMDFFMjlDMDczRUYyMTAxMUUyRDY1QHFxLnNvaHUuY29tfHVuaXFuYW1lOjEwOnN5bmNfaW4lM0F8; pprdig=qwEyeznjaoVcXDnO56TXPKA0U3oScXzw__VNGjC6BVJdDsta7AndQyzWyjemkvrUzwJTNRYk61ZMDx6Lb3nqiLb25o4WFavBNqXhLr1gh5LDykqxl9e5qfFA3wLI9blK7kqzLYwhdFYbSTfC9lgTmWLf6JKKA_PZb0AU4aA4AlM; ppmdig=145607980600000074cfc3e2b64bdab74e564d63b2148c53";
    // cookies = [cookies2];
    // //var cookies = fs.readFileSync('cookies.txt', 'utf8');
    // // First I want to read the file
    // // fs.readFile('./cookies.txt', function read(err, data) {
    // //     if (err) {
    // //         throw err;
    // //     }
    // //     cookies = data;

    // //     // Invoke the next step here however you like
    // //     this.echo(cookies);   // Put all of the code here (not the best solution)
    // // });
    // this.echo("Cookies : " + cookies1);
    // if (cookies1 && cookies1.length > 0) {
    //     cookies1 = cookies1.trim();
    //     this.echo("Added cookies");
    //     cookies1.split(";").forEach(function (pair) {
    //         pair = pair.split("=");
    //         phantom.addCookie({
    //             'name': pair[0],
    //             'value': pair[1],
    //             'domain': 'weixin.sogou.com'
    //         });
    //     });
    // }
});

casper.run(check);
