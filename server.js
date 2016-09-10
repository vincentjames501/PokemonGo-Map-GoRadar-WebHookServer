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

function atob(str) {
    return new Buffer(str, 'base64').toString('binary');
}

function wrapMessage(message, type) {
    return {
        pokemon: type === 'pokemon' ? [message] : [],
        validation1: "Tc\u00a1\u0012\u009cz8Y\u00c5\u009f\u00e8\u0015{L;\u00f4\u008aTC\u0090", //todo
        pokestops: type === 'pokestops' ? [message] : [],
        gyms: type === 'gyms' ? [message] : []
    };
}

function transformPokestopMessage(message) {
    /*
         Message will look like this:
         {
             "lure_expiration": 1473517722,
             "pokestop_id": "MWM2OTc1OGVhZmY4NDgxNzgyNDlhODliYWIyMjE0ZDEuMTY=",
             "enabled": true,
             "longitude": -89.399246,
             "last_modified_time": 1473515922311,
             "active_fort_modifier": "9QM=",
             "latitude": 43.072189
         }
     */
    return wrapMessage(
        {
            enabled: message.enabled,
            longitude: message.longitude,
            last_modified: message.last_modified,
            lure_expiration: message.lure_expiration,
            latitude: message.latitude,
            active_pokemon_id: 0, // todo
            pokestop_id: atob(message.pokestop_id)
        },
        'pokestops'
    );
}

function transformGymMessage(message) {
    /*
         Message will look like this:
         {
             "team_id": 2,
             "gym_points": 17881,
             "last_modified": 1473497938,
             "latitude": 43.072407,
             "guard_pokemon_id": 134,
             "enabled": true,
             "gym_id": "ODE5NTM2Y2Q0NjJmNDhiNjk5YjQ1MTg3YTg4OTQ2MWUuMTY=",
             "longitude": -89.41029
         }
         I could never get it to send this data so I don't know what
         the payload is, so skipping for now...
     */
    return null;
}

function transformPokemonMessage(message) {
    /*
         Message will look like this:
         {
             "time_until_hidden_ms": 510078,
             "last_modified_time": 1473516065078,
             "disappear_time": 1473516575,
             "pokemon_id": 41,
             "latitude": 43.0763802737175,
             "spawnpoint_id": "8807acb57c5",
             "encounter_id": "MzI1OTc1NDY5NjA3MjEzNDc0OQ==",
             "longitude": -89.4004888854575
         }
    */
    return wrapMessage(
        {
            spawn_id: atob(message.encounter_id),
            id: parseInt(atob(message.encounter_id)),
            lat: message.latitude,
            type: message.pokemon_id,
            lon: message.longitude,
            despawn_time: message.time_until_hidden_ms
        },
        'pokemon'
    );
}

function transformPayload(payload) {
    if (payload) {
        const {type, message} = payload;
        switch (type) {
            case 'pokestop':
                return transformPokestopMessage(message);
            case 'gym':
                return transformGymMessage(message);
            case 'pokemon':
                return transformPokemonMessage(message);
            default:
                console.warn('Unknown payload type', payload);
                return null;
        }
    } else {
        console.warn('Unknown payload received', payload);
        return null;
    }
}

function sendToGoRadar(payload, callback) {
    const req = https.request({
        host: 'data.goradar.io',
        path: '/submit',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'pokemongo/0.35.0 (iPhone; iOS 9.3.5; Scale/2.00)'
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
            const payloadToSend = transformPayload(parsed);
            sendToGoRadar(payloadToSend, (statusCode, payload) => {
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