/*****************************************/
/* Scenario Server                      */
/* By: Travis Rosenbaum                */
/* TRosenbaum@gmail.com               */
/*************************************/

var config = require('config').get("ScenarioSettings");
var mqtt = require('mqtt');
var omx = require('node-omxplayer');

var player = omx();

var isPaused = false;

console.log("Starting Scenario Service.");
console.log(config);
var client  = mqtt.connect(config.mqttServer);
 
client.on('connect', function () {
    console.log("Connected to MQTT Broker at " + config.mqttServer);
    client.publish('scenario/status', 'Connected');
    client.subscribe('scenario/control');
    client.subscribe('video/control');
});

client.on('message', function (topic, message) {
    var command = message.toString();
	switch (topic) {

        case "scenario/control":
            console.log("Scenario Command: " + command);
            switch (command) {
                case "reset":
                    client.publish("global/lights", "255,255,255");
                    client.publish("video/control", "stop");
                    break;
                case "start":
                    // TODO: Timers
                    client.publish("global/lights", "255,255,255");
                    client.publish("video/control", "restart");
                    break;

                case "pause":
                    client.publish("video/control", "pause");
                    client.publish("global/lights", "255,255,0");
                    break;

                case "resume":
                    client.publish("video/control", "play");
                    client.publish("global/lights", "255,255,255");
                    break;

                case "endsuccess":
                    client.publish("video/control", "stop");
                    client.publish("global/lights", "0,255,0");
                    break;

                case "endfailure":
                    client.publish("video/control", "stop");
                    client.publish("global/lights", "255,0,0");
                    break;

                default:
                    console.log("Unsupported scenario command '" + command + "'.");
                    break;
            }
            break;

        case "video/control":
            console.log("Video Command: " + command);
            switch (command) {
                case "restart":
                    player.newSource(config.videoSource.source, config.videoSource.output, config.videoSource.loop, config.videoSource.initialVolume);
                    isPaused = false;
                    break;

                case "play":
                    if(player.running)
                    {
                        if (isPaused) {
                            player.play();
                            isPaused = false;
                        }
                    }
                    else
                    {
                        player.newSource(config.videoSource.source, config.videoSource.output, config.videoSource.loop, config.videoSource.initialVolume);
                    }
                    break;

                case "pause":
                    if(player.running)
                    {
                        if (!isPaused) {
                            player.pause();
                            isPaused = true;
                        }
                    }
                    else
                    {
                        console.log("Cannot pause: Player not running.");
                    }
                    break;

                case "stop":
                case "quit":
                    if(player.running)
                    {
                        player.quit();
                    }
                    else
                    {
                        console.log("Cannot quit: Player not running.");
                    }
                    isPaused = false;
                    break;

                case "volup":
                    if(player.running)
                    {
                        player.volUp();
                    }
                    else
                    {
                        console.log("Cannot volUp: Player not running.");
                    }
                    break;

                case "voldown":
                    if(player.running)
                    {
                        player.volDown();
                    }
                    else
                    {
                        console.log("Cannot volDown: Player not running.");
                    }
                    break;

                default:
                    console.log("Unsupported video command '" + command + "'.");
                    break;
            }
            break;

        default: // Unknown topic
            console.log("Unsupported topic '" + topic + "'.")
            break;
    }
});

process.on('uncaughtException', function (err) {
    console.trace(err.stack);
    if(player.running)
    {
        player.quit();
    }
    process.exit(-1);
});

process.on('SIGINT',function() {
    if(player.running)
    {
        player.quit();
    }

    client.end();
    process.exit();
 });
