var http = require('http');
var https = require('https');
var	httpProxy = require('http-proxy');
var fs = require("fs");
var config = require("config");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var args = process.argv.slice(2);
var target;
if (!args.length) {
	console.error("Missing target site");
	return;
} else {
	target = args[args.length - 1];
}
var targetHost = target.substr(target.indexOf("//") + 2);
var port = process.env.PORT || config.listener.port || 5050;
var host = config.listener.host || "localhost";
//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer();
var proxyTarget = (config.listener.secure) ?
	'https://' + host + ((port === 443) ? "" : (":" + port)) :
	'http://' + host + ((port === 80) ? "" : (":" + port));

// To modify the proxy connection before data is sent, you can listen
// for the 'proxyReq' event. When the event is fired, you will receive
// the following arguments:
// (http.ClientRequest proxyReq, http.IncomingMessage req,
//  http.ServerResponse res, Object options). This mechanism is useful when
// you need to modify the proxy request before the proxy connection
// is made to the target.
//

proxy.on('proxyReq', function (proxyReq, req, res, options) {
	if (config.cors) {
		res.setHeader('Access-Control-Allow-Origin', config.cors.origin);
		res.setHeader("Access-Control-Allow-Headers", config.cors.headers || "Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With");
		res.setHeader("Access-Control-Allow-Methods", config.cors.methods || "GET, PUT, POST, PUT, DELETE, OPTIONS");
		res.setHeader("Access-Control-Allow-Credentials", !!config.cors.credentials);
	}

	proxyReq.setHeader("Host", targetHost);
});

proxy.on('proxyRes', function (proxyRes, req, res) {
	// reset the location of redirect responses
	var location = proxyRes.headers.location;
	if (location && location.indexOf(target) >= 0) {
		proxyRes.headers.location = location.replace(target, proxyTarget);
	}

	// convert cookies to the proxy's domain
	var cookies = proxyRes.headers["set-cookie"];
	if (cookies && cookies.length) {
		for (var i = 0; i < cookies.length; i++) {
			cookies[i] = cookies[i].replace(/;\s+HttpOnly/, "")
			if (!config.secure) {
				cookies[i] = cookies[i].replace(/;\s+Secure/, "");
			}
		}
	}
});

var handler = function (req, res) {
	// You can define here your custom logic to handle the request
	// and then proxy the request.
	proxy.web(req, res, {
		target: target
	});
};

var server;
if (config.listener.secure) {
	var sslOptions = {
		key: fs.readFileSync(config.listener.ssl.key, 'utf8'),
		cert: fs.readFileSync(config.listener.ssl.cert, 'utf8')
	};
	server = https.createServer(sslOptions, handler);

} else {
	server = http.createServer(handler);
}

server.listen(port || 5050);
console.log("listening on port " + port);




// for testing
/*
http.createServer(function (req, res) {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
	res.end();
}).listen(9008);
console.log("listening on port 9008");
*/
