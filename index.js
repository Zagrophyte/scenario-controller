/*****************************************/
/* Scenario Server                      */
/* By: Travis Rosenbaum                */
/* TRosenbaum@gmail.com               */
/*************************************/

var config = require('config').get("ScenarioSettings");

var mqtt = require('mqtt');
var omx = require('node-omxplayer');
var soundPlayer = require('play-sound')(opts={});
var hue = require("node-hue-api");
var hueApi = hue.HueApi(config.hueHost, config.hueUser);
var lightState = hue.lightState;
var request = require('request');
var exec = require('child_process').exec;

function execute(command, callback){
    exec(command, function(error, stdout, stderr){ callback(stdout); });
}

var isPaused = false;

var player = omx()

var displayResult = function(result) {
    console.log(JSON.stringify(result, null, 2));
};

let setWebRelayState = function(state) {
    try {
        // WebRelay Reset
        var url = "http://" + config.webRelayHost + "/state.xml?relayState=" + state;
        request.get(url, 
            function(err, resp, body){
                if (err) {
                    if (err.code && err.code == "HPE_INVALID_CONSTANT") {
                        // Expected error, WebRelay returns no headers on response.
                    }
                    else {
                        displayResult(err);
                    }
                }
            }).auth(config.webRelayUser, config.webRelayPass, true);
        } 
    catch (err) { 
        displayResult(err); 
    }
};

hueApi.config(function(err, config) {
    if (err) {
        displayResult(err);
    }
    else {
        //displayResult(config);
    }
});

console.log("Starting Scenario Service.");
//console.log(config);
var client  = mqtt.connect(config.mqttHost);

client.on('connect', function () {
    console.log("Connected to MQTT Broker at " + config.mqttHost);
    client.publish('status/scenario', 'Connected');
    client.subscribe('scenario/control');
    client.subscribe('video/control');
    client.subscribe('sound/control');
    client.subscribe('global/lights');
});

client.on('message', function (topic, message) {
    var command = message.toString();
	switch (topic) {
        case "global/lights":
            try {
                // This subscription is primarily to relay color commands to the Philips Hue lighting systems
                console.log("Global Light Command: " + command);
                var colors = command.split(',');
                if (colors.length == 3) {
                    var colorState = undefined;
                    var redC = parseInt(colors[0]);
                    var greenC = parseInt(colors[1]);
                    var blueC = parseInt(colors[2]);
                    if (redC + greenC + blueC <= 0) { 
                        // Off
                        colorState =  lightState.create().off();
                    }
                    else {
                        // Color 
                        colorState  = lightState.create().on().brightness(100).rgb(redC, greenC, blueC);
                    }
                    hueApi.lights(function(err, lights) {
                        lights = lights.lights;
                        if (err) {
                            displayResult("HUE Error" + err)
                        }
                        else {
                            for (var i = 0, len = lights.length; i < len; i++) {
                                hueApi.setLightState(parseInt(lights[i].id), colorState, function(err, result) {
                                    if (err) {
                                        displayResult("HUE Error: " + err);
                                    }
                                    //displayResult(result);
                                });
                            }
                        }
                    });
                }
                else {
                    console.log("Invalid Color String: " + command);
                }
            }
            catch (err) {
                displayResult("HUE Error: " + err);
            }
            break;

        case "scenario/control":
            console.log("Scenario Command: " + command);
            switch (command) {

                case "lightson":
                    client.publish("global/lights", "255,255,255");
                    client.publish("sound/control", "powerup");
                    break;

                case "lightsoff":
                    client.publish("global/lights", "0,0,0");
                    client.publish("sound/control", "powerdown");
                    break;

                case "staging":
                    client.publish("global/lights", "255,255,255");
                    client.publish("video/control", "stop");
                    setWebRelayState(0);
                    break;

                case "reset":
                    client.publish("global/lights", "255,255,255");
                    client.publish("video/control", "stop");
                    setWebRelayState(1);
                    break;

                case "start":
                    // TODO: Timers
                    setWebRelayState(1);
                    client.publish("global/lights", "255,255,255");
                    client.publish("video/control", "restart");
                    break;

                case "pause":
                    // TODO: Timers
                    client.publish("video/control", "pause");
                    client.publish("global/lights", "0,0,255");
                    break;

                case "resume":
                    client.publish("video/control", "play");
                    client.publish("global/lights", "255,255,255");
                    break;

                case "endsuccess":
                    client.publish("video/control", "stop");
                    client.publish("global/lights", "0,255,0");
                    client.publish("sound/control", "endsuccess");
                    break;

                case "endfailure":
                    client.publish("video/control", "stop");
                    client.publish("global/lights", "255,0,0");
                    client.publish("sound/control", "endfailure");
                    break;

                case "keepopen":
                    client.publish("airlock/relays/1", "-1");
                    break;

                case "open":
                    client.publish("airlock/open", "8000");
                    break;

                case "close":
                    client.publish("airlock/relays/1", "0");
                    break;

                case "safetyoff":
                    client.publish("airlock/safety", "0");
                    break;

                case "safetyon":
                    client.publish("airlock/safety", "1");
                    break;

                case "reboot":
                    execute('shutdown -r now', function(callback){
                        console.log(callback);
                    });
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
                    player.newSource(config.videoSource.source, 'both', false, 0);
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
                        player.newSource(config.videoSource.source, 'both', false, 0);
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

                    // Clean up any stragglers
                    execute('killall omxplayer', function(callback){
                        console.log(callback);
                    });
                    execute('killall omxplayer.bin', function(callback){
                        console.log(callback);
                    });

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

        case "sound/control":
            console.log("Sound Command: " + command);
            switch (command) {
                case "powerdown":
                    soundPlayer.play(config.powerDownSound.source);
                    break;

                case "powerup":
                    soundPlayer.play(config.powerUpSound.source);
                    break;

                case "endsuccess":
                    soundPlayer.play(config.endSuccessSound.source);
                    break;

                case "endfailure":
                    soundPlayer.play(config.endFailureSound.source);
                    break;

                case "stop":
                case "quit":
                    soundPlayer.quit();
                    break;

                default:
                    console.log("Unsupported sound command '" + command + "'.");
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
    try {
        if(videoPlayer.running)
        {
            player.quit();
        }
        soundPlayer.quit();
    }
    catch(err) {
        console.log(err);
    }
    process.exit(-1);
});

process.on('SIGINT',function() {
    try {
        if(videoPlayer.running)
        {
            player.quit();
        }
        soundPlayer.quit();
    }
    catch(err) {
        console.log(err);
    }

    client.end();
    process.exit();
 });
