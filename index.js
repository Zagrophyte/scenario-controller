/************************************/
// Options
var videoSource = "/home/pi/big_buck_bunny.mp4"
var mqttServer = "192.168.1.7"
/************************************/

var mqtt = require('mqtt');
var omx = require('node-omxplayer');

var player = omx(videoSource, "both", false);

console.log("Starting Scenario Service.");
var client  = mqtt.connect("mqtt://" + mqttServer);
 
client.on('connect', function () {
    console.log("Connected to MQTT Broker at " + mqttServer);    
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
                    player.newSource(videoSource);
                    break;

                case "play":
                    if(player.running) 
                    {
                        player.play();
                    }
                    else
                    { 
                        player.newSource(videoSource);
                    }
                    break;

                case "pause":
                    if(player.running) 
                    {
                        player.pause();
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

process.on('SIGINT',function(){
    player.quit();
    client.end();
    process.exit();
 });
