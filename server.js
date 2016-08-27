const http = require('http');
const https = require('https');

// Constants

const DIVIDER = '--------------------------------------------';

// Options

var port = 8080;
var verbose = false;

// Parse Arguments

const programArgs = process.argv.slice(2);

function printHelp(exitCode = 0) {
    console.info('Usage: node server.js [--verbose] [--port PORT]');
    console.info('\nOptions');
    console.info('  --port PORT, -p PORT          What port the server should run on. Default: 8080');
    console.info('  --verbose, -v                 Verbose logging enabled. Default: false');
    process.exit(exitCode);
}

programArgs.forEach(function (arg, index) {
    if (arg === '--verbose' || arg === '-v') {
        verbose = true;
    } else if (arg === '--port' || arg === '-p') {
        var portArg = programArgs[index + 1];
        try {
            port = parseInt(portArg);
        } catch (e) {
            console.log(`Unknown port: ${portArg}`);
            printHelp(1);
        }
    } else if (arg === '--help' || arg === '-h') {
        printHelp();
    } else {
        console.log(`Unknown option: ${arg}`);
        printHelp(1);
    }
});

// GoRadar API

function sendToGoRadar(payload, callback) {
    const req = https.request({
        host: 'map_data.goradar.io',
        path: '/integers',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }, (resp) => {
        const body = [];
        resp.on('error', (err) => console.error(err))
            .on('data', (chunk) => body.push(chunk))
            .on('end', function () {
                const payload = Buffer.concat(body).toString();
                if (callback) {
                    callback(resp.statusCode, payload);
                }
            });
    });
    req.write(JSON.stringify(payload));
    req.on('error', (err, a, b) => console.error('Failed to send data to GoRadar', err, a, b));
    req.end();
}

// Server

http.createServer((req, resp) => {
    console.log(`${DIVIDER}\nReceived Request\n`);
    const body = [];
    req.on('error', (err) => console.error(err))
        .on('data', (chunk) => body.push(chunk))
        .on('end', () => {
            const payload = Buffer.concat(body).toString();
            const parsed = JSON.parse(payload);
            sendToGoRadar(parsed, (statusCode, payload) => {
                if (statusCode === 200) {
                    console.log('Successfully delivered data to GoRadar');
                    resp.writeHead(200, {'Content-Type': 'application/json'});
                    resp.end('{"message": "success"}');
                    console.log(DIVIDER);
                } else {
                    console.error(`Send to GoRadar failed.\nResponse Code: ${statusCode}\nPayload: ${payload}`);
                    resp.writeHead(500, {'Content-Type': 'application/json'});
                    resp.end('{"message": "failed"}');
                    console.log(DIVIDER);
                }
            });

        });
}).listen(port, () => console.log(`Server listening on http://localhost:${port}`));