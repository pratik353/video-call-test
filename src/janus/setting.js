
var server = null;
var server = "ws://13.127.219.115:8188/ws";
// var server = "http://3.101.68.236:8088/janus";
// if(window.location.protocol === 'http:')
// 	server = "ws://3.101.68.236:8188/ws";
// else
// 	server = "wss://3.101.68.236:8188/ws";

var iceServers = [{urls: "turn:13.57.235.158:3478?transport=tcp", username: "test", credential: "test123"}];

export {iceServers, server};

