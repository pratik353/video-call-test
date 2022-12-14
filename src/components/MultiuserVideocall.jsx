import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import useMultiuserVideocallHook from "../customHooks/multiuserVideocallHook";
import "./videoStream.css";
import { fabric } from "fabric";

import { io } from "socket.io-client";

import Janus from "../janus/janus";
import { server, iceServers } from "../janus/setting";

var janus = null;
var sfutest = null;
var opaqueId = "videoroom-" + Janus.randomString(12);

var myroom = 1234; // Demo room

var myusername = null;
var myid = null;
var mystream = null;
// We use this other ID just to map our subscriptions to us
var mypvtid = null;

var localTracks = {},
  localVideos = 0;
var feeds = [],
  feedStreams = {};
var bitrateTimer = [];

let zoom = 1;
var canvas;
let videoTrack = []; 

let  capabilities;
let settings;

const MultiuserVideocall = () => {
  const location = useLocation();

  const customRoomIdRef = useRef(0);
  const captureVideoRef = useRef();
  const remoteVideoRef = useRef();
  const remoteAudioRef = useRef();
  const localVideoRef = useRef();
  const localAudioRef = useRef();
  const usernameRef = useRef();
  const inputRef = useRef();

  // const [isMuted, setIsMuted] = useState();
  const [isPublishOwnFeed, setPublishOwnFeed] = useState();
  let isMuted;
  // const [ownId, setOwnId] = useState();
  let remoteUserName;
  // const [remoteUserName, setRemoteUserName] = useState("");
  const [counter, setCounter] = useState(0);
  console.warn("counter ", counter);

  if (getQueryStringValue("room") !== "")
    customRoomIdRef.current.value = parseInt(getQueryStringValue("room"));

  var doSimulcast =
    getQueryStringValue("simulcast") === "yes" ||
    getQueryStringValue("simulcast") === "true";
  var acodec =
    getQueryStringValue("acodec") !== "" ? getQueryStringValue("acodec") : null;
  var vcodec =
    getQueryStringValue("vcodec") !== "" ? getQueryStringValue("vcodec") : null;
  var doDtx =
    getQueryStringValue("dtx") === "yes" ||
    getQueryStringValue("dtx") === "true";
  var subscriber_mode =
    getQueryStringValue("subscriber-mode") === "yes" ||
    getQueryStringValue("subscriber-mode") === "true";
  var use_msid =
    getQueryStringValue("msid") === "yes" ||
    getQueryStringValue("msid") === "true";

  let socket = io.connect("http://192.168.1.69:3001");

  // var rect = new fabric.Rect({
  //   hoverCursor: "pointer",
  //   left: 100,
  //   top: 100,
  //   fill: "transparent",
  //   width: 80,
  //   height: 80,
  //   strokeWidth: 2,
  //   stroke: "red",
  // });

  // var circle = (circle = new fabric.Circle({
  //   radius: 30,
  //   fill: "red",
  //   left: 100,
  //   top: 100,
  // }));

  console.log("component renderd");

  useEffect(() => {
    // socket = io.connect("http://192.168.1.69:3001");
    // console.log(socket);

    // Janus Initialization
    Janus.init({
      debug: "all",
      callback: function () {
        janusStart();
      },
    });
    canvas = new fabric.Canvas("canvas", {});

    // set video stream size to canvas size
    let remoteStream = document.querySelector("#stream");
    const vidStyleData = remoteStream.getBoundingClientRect();
    canvas.setDimensions({
      // width: vidStyleData.width,
      width: 1080,
      // height: vidStyleData.height,
      height: 420,
    });

    // get support constraints of camera stream
    const supports = navigator.mediaDevices.getSupportedConstraints()
    console.log('supports ', supports);
  }, []);

  useEffect(() => {
    // canvas.remove(rect);
    canvas.on({
      "object:modified": function (e) {
        // console.log(e);
        console.log(canvas.getObjects().length);
        console.log(e.target.get("type"));
        let active_shape = canvas.getActiveObject();
        let coords = active_shape.aCoords;
        let type = e.target.get("type");
        // let type = 'rectangle'
        // canvas.on('object:selected', ()=>{
        //   console.log(e.target.get('type'));
        // });
        console.log(active_shape);
        socket.emit("coords", { type, coords });
      },
    });
  }, []);

  // useEffect(() => {
  //   // Drawing Object On Canvas
  //   socket.on("coords", (coords) => {
  //     // canvas.remove(rect);
  //     console.log("coords ", coords);
  //     if (coords.type === "rect") {
  //       let rect = new fabric.Rect({
  //         left: coords.coords.tl.x,
  //         top: coords.coords.tl.y,
  //         fill: "transparent",
  //         width: 80,
  //         height: 80,
  //         strokeWidth: 2,
  //         stroke: "red",
  //       });
  //       canvas.add(rect);
  //     } else if (coords.type === "circle") {
  //       // canvas.remove(circle);
  //       let circle = new fabric.Circle({
  //         radius: 30,
  //         fill: "transparent",
  //         left: coords.coords.tl.x,
  //         top: coords.coords.tl.y,
  //         strokeWidth: 2,
  //         stroke: "red",
  //       });
  //       canvas.add(circle);
  //     }
  //   });

  //   // Removing object
  //   socket.on("remove_object", (object) => {
  //     console.log(object);
  //     if (object.object === "rect") {
  //       console.log("true");
  //       canvas.remove(object.object);
  //     } else if (object.object === "circle") {
  //       canvas.remove(object.object);
  //     }
  //   });
  // }, [socket]);

  // Create new Janus Server
  const janusStart = () => {
    console.log("janus start on server", server);

    // calls the Janus function in janus.js file
    janus = new Janus({
      server: server,
      iceServers: iceServers,
      iceTransportPolicy: "all", // It should work with relay
      success: () => {
        console.log("janus success");
        // attach video room plugin
        janus.attach({
          plugin: "janus.plugin.videoroom",
          opaqueId: opaqueId,
          success: (pluginHandle) => {
            // after successfully attached it return pluginHandle
            sfutest = pluginHandle;
            Janus.log(
              "Plugin attached! (" +
                sfutest.getPlugin() +
                ", id=" +
                sfutest.getId() +
                ")"
            );
            Janus.log("  -- This is a publisher/manager");
          },
          error: (error) => {
            alert("  -- Error attaching plugin...", error);
          },
          consentDialog: function (on) {
            Janus.debug(
              "Consent dialog should be " + (on ? "on" : "off") + " now"
            );
            if (on) {
              // Darken screen and show hint
              console.log("Consent dialog on");
            } else {
              // Restore screen
              console.log("restor screen");
            }
          },
          iceState: function (state) {
            Janus.log("ICE state changed to " + state);
          },
          mediaState: function (medium, on, mid) {
            Janus.log(
              "Janus " +
                (on ? "started" : "stopped") +
                " receiving our " +
                medium +
                " (mid=" +
                mid +
                ")"
            );
          },
          slowLink: function (uplink, lost, mid) {
            Janus.warn(
              "Janus reports problems " +
                (uplink ? "sending" : "receiving") +
                " packets on mid " +
                mid +
                " (" +
                lost +
                " lost packets)"
            );
          },
          onmessage: function (msg, jsep) {
            Janus.debug(" ::: Got a message (publisher) :::", msg);
            var event = msg["videoroom"];
            Janus.warn("Event: " + event);
            if (event) {
              if (event === "joined") {
                myid = msg["id"];
                mypvtid = msg["private_id"];
                Janus.log(
                  "Successfully joined room " + msg["room"] + " with ID " + myid
                );
                // setOwnId(myid);
                alert(
                  "Successfully joined room " + msg["room"] + " with ID " + myid
                );
                if (subscriber_mode) {
                  // $("#videojoin").hide();
                  // $("#videos").removeClass("hide").show();
                } else {
                  publishOwnFeed(true);
                }
                if (msg["publishers"].length !== 0) {
                  remoteUserName = msg["publishers"][0].display;
                }
                console.log('msg["publishers"] ', msg["publishers"]);
                // Any new feed to attach to?
                if (msg["publishers"]) {
                  var list = msg["publishers"];
                  setCounter(list.length);
                  Janus.debug(
                    "Got a list of available publishers/feeds:",
                    list
                  );
                  for (var f in list) {
                    if (list[f]["dummy"]) continue;
                    var id = list[f]["id"];
                    var streams = list[f]["streams"];
                    var display = list[f]["display"];
                    for (var i in streams) {
                      var stream = streams[i];
                      stream["id"] = id;
                      stream["display"] = display;
                    }
                    feedStreams[id] = streams;
                    Janus.debug("  >> [" + id + "] " + display + ":", streams);
                    alert("newRemote stream createed");
                    newRemoteFeed(id, display, streams);
                  }
                }
              } else if (event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
                alert("The room has been destroyed", function () {});
                window.location.reload();
              } else if (event === "event") {
                console.log("in event ", msg);
                // Any info on our streams or a new feed to attach to?
                if (msg["streams"]) {
                  console.log("get streams", msg["streams"]);
                  var streams = msg["streams"];
                  for (var i in streams) {
                    var stream = streams[i];
                    stream["id"] = myid;
                    stream["display"] = myusername;
                  }
                  feedStreams[myid] = streams;
                } else if (msg["publishers"]) {
                  var list = msg["publishers"];
                  Janus.debug(
                    "Got a list of available publishers/feeds:",
                    list
                  );
                  for (var f in list) {
                    if (list[f]["dummy"]) continue;
                    var id = list[f]["id"];
                    var display = list[f]["display"];
                    var streams = list[f]["streams"];
                    for (var i in streams) {
                      var stream = streams[i];
                      stream["id"] = id;
                      stream["display"] = display;
                    }
                    feedStreams[id] = streams;
                    Janus.debug("  >> [" + id + "] " + display + ":", streams);
                    newRemoteFeed(id, display, streams);
                  }
                } else if (msg["leaving"]) {
                  // One of the publishers has gone away?
                  var leaving = msg["leaving"];
                  remoteUserName = "";
                  alert(`user left`);
                  Janus.log("Publisher left: " + leaving);
                  var remoteFeed = null;
                  for (var i = 1; i < 6; i++) {
                    if (feeds[i] && feeds[i].rfid == leaving) {
                      remoteFeed = feeds[i];
                      break;
                    }
                  }
                  if (remoteFeed) {
                    Janus.debug(
                      "Feed " +
                        remoteFeed.rfid +
                        " (" +
                        remoteFeed.rfdisplay +
                        ") has left the room, detaching"
                    );
                    // $('#remote'+remoteFeed.rfindex).empty().hide();
                    console.warn("#remote" + remoteFeed.rfindex);
                    // $('#videoremote'+remoteFeed.rfindex).empty();
                    console.warn("#videoremote" + remoteFeed.rfindex);
                    feeds[remoteFeed.rfindex] = null;
                    remoteFeed.detach();
                  }
                  delete feedStreams[leaving];
                } else if (msg["unpublished"]) {
                  // One of the publishers has unpublished?
                  var unpublished = msg["unpublished"];
                  Janus.log("Publisher left: " + unpublished);
                  if (unpublished === "ok") {
                    // That's us
                    sfutest.hangup();
                    return;
                  }
                  var remoteFeed = null;
                  for (var i = 1; i < 6; i++) {
                    if (feeds[i] && feeds[i].rfid == unpublished) {
                      remoteFeed = feeds[i];
                      break;
                    }
                  }
                  if (remoteFeed) {
                    Janus.debug(
                      "Feed " +
                        remoteFeed.rfid +
                        " (" +
                        remoteFeed.rfdisplay +
                        ") has left the room, detaching"
                    );
                    // $('#remote'+remoteFeed.rfindex).empty().hide();
                    console.warn("#remote" + remoteFeed.rfindex);
                    // $('#videoremote'+remoteFeed.rfindex).empty();
                    console.warn("#videoremote" + remoteFeed.rfindex);
                    feeds[remoteFeed.rfindex] = null;
                    remoteFeed.detach();
                  }
                  delete feedStreams[unpublished];
                } else if (msg["error"]) {
                  if (msg["error_code"] === 426) {
                    // This is a "no such room" error: give a more meaningful description
                    alert(
                      "<p>Apparently room <code>" +
                        // customRoomIdRef.current.value +
                        myroom +
                        "</code> (the one this demo uses as a test room) " +
                        "does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
                        "configuration file? If not, make sure you copy the details of room <code>" +
                        // customRoomIdRef.current.value +
                        myroom +
                        "</code> " +
                        "from that sample in your current configuration file, then restart Janus and try again."
                    );
                  } else {
                    alert(msg["error"]);
                  }
                }
              }
            }
            console.warn("jsep ", jsep);
            if (jsep) {
              Janus.debug("Handling SDP as well...", jsep);
              // set answerSDP to remoteSDP
              sfutest.handleRemoteJsep({ jsep: jsep });
              // Check if any of the media we wanted to publish has
              // been rejected (e.g., wrong or unsupported codec)
              var audio = msg["audio_codec"];
              if (
                mystream &&
                mystream.getAudioTracks() &&
                mystream.getAudioTracks().length > 0 &&
                !audio
              ) {
                // Audio has been rejected
                alert(
                  "Our audio stream has been rejected, viewers won't hear us"
                );
              }
              var video = msg["video_codec"];
              if (
                mystream &&
                mystream.getVideoTracks() &&
                mystream.getVideoTracks().length > 0 &&
                !video
              ) {
                // Video has been rejected
                alert(
                  "Our video stream has been rejected, viewers won't see us"
                );
                // Hide the webcam video
                // $('#myvideo').hide();
                // $('#videolocal').append(
                // 	'<div class="no-video-container">' +
                // 		'<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
                // 		'<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
                // 	'</div>');
              }
            }
          },
          onlocaltrack: function (track, on) {
            Janus.log(
              "Local track " + (on ? "added" : "removed") + ":",
              track
            );
            console.log();
            // track = track.push({zoom: true})
            // We use the track ID as name of the element, but it may contain invalid characters
            var trackId = track.id.replace(/[{}]/g, "");
            if (!on) {
              // Track removed, get rid of the stream and the rendering
              var stream = localTracks[trackId];
              if (stream) {
                try {
                  var tracks = stream.getTracks();
                  for (var i in tracks) {
                    var mst = tracks[i];
                    if (mst !== null && mst !== undefined) mst.stop();
                  }
                } catch (e) {}
              }
              if (track.kind === "video") {
                // $('#myvideo' + trackId).remove();
                localVideos--;
                if (localVideos === 0) {
                  // No video, at least for now: show a placeholder
                  // if($('#videolocal .no-video-container').length === 0) {
                  // 	$('#videolocal').append(
                  // 		'<div class="no-video-container">' +
                  // 			'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                  // 			'<span class="no-video-text">No webcam available</span>' +
                  // 		'</div>');
                  // }
                }
              }
              delete localTracks[trackId];
              return;
            }

            // If we're here, a new track was added
            var stream = localTracks[trackId];
            if (stream) {
              // We've been here already
              return;
            }

            // append mute button functionality remaining line 321- 329

            if (track.kind === "audio") {
              // We ignore local audio tracks, they'd generate echo anyway
              if (localVideos === 0) {
                // No video, at least for now: show a placeholder
                // if($('#videolocal .no-video-container').length === 0) {
                // 	$('#videolocal').append(
                // 		'<div class="no-video-container">' +
                // 			'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                // 			'<span class="no-video-text">No webcam available</span>' +
                // 		'</div>');
                // }
              }
            } else {
              // New video track: create a stream out of it
              localVideos++;
              // $('#videolocal .no-video-container').remove();
              stream = new MediaStream([track]);
               localTracks[trackId] = stream;
              Janus.log("Created local stream:", stream)

              // $('#videolocal').append('<video class="rounded centered" id="myvideo' + trackId + '" width=100% autoplay playsinline muted="muted"/>');
              Janus.attachMediaStream(localVideoRef.current, stream);
            }
            if (
              sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
              sfutest.webrtcStuff.pc.iceConnectionState !== "connected"
            ) {
              // $("#videolocal").parent().parent().block({
              // 	message: '<b>Publishing...</b>',
              // 	css: {
              // 		border: 'none',
              // 		backgroundColor: 'transparent',
              // 		color: 'white'
              // 	}
              // });
              console.log("publishing.. ");
            }
          },
        });
      },
      error: function (error) {
        Janus.error(error);
        alert(error, function () {
          window.location.reload();
        });
      },
      destroyed: function () {
        window.location.reload();
      },
    });
  };

  // Helper to escape XML tags
  function escapeXmlTags(value) {
    if (value) {
      var escapedValue = value.replace(new RegExp("<", "g"), "&lt");
      escapedValue = escapedValue.replace(new RegExp(">", "g"), "&gt");
      return escapedValue;
    }
  }

  function getQueryStringValue(name) {
    console.log(location.pathname, name);
    // alert('location.pathname', location.pathname)
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      // results = regex.exec(location.pathname.search);
      results = location.pathname.slice(1);
    return results === null ? "" : results;
  }
  const registerUser = (username) => {
    if (username === "") {
      alert("Insert a username to register (e.g., pippo)");
      return;
    } else {
      console.log(username);
      var register = {
        request: "join",
        room: parseInt(customRoomIdRef.current.value),
        // room: parseInt(myroom),
        ptype: "publisher",
        display: username,
      };
      myusername = escapeXmlTags(username);
      sfutest.send({ message: register });
    }
  };

  function publishOwnFeed(useAudio) {
    // Publish our stream
    // $('#publish').attr('disabled', true).unbind('click');

    // We want sendonly audio and video (uncomment the data track
    // too if you want to publish via datachannels as well)
    let tracks = [];
    if (useAudio) tracks.push({ type: "audio", capture: true, recv: false });
    tracks.push({
      type: "video",
      capture: true,
      recv: false,
      simulcast: doSimulcast,
    });
    // tracks.push({ type: 'data' });

    console.log("get tracks ", tracks);
    sfutest.createOffer({
      tracks: tracks,
      customizeSdp: function (jsep) {
        // If DTX is enabled, munge the SDP
        if (doDtx) {
          jsep.sdp = jsep.sdp.replace(
            "useinbandfec=1",
            "useinbandfec=1;usedtx=1"
          );
        }
      },
      success: function (jsep) {
        Janus.debug("Got publisher SDP!", jsep);

        var publish = { request: "configure", audio: useAudio, video: true };
        // // You can force a specific codec to use when publishing by using the
        // // audiocodec and videocodec properties, for instance:
        // // 		publish["audiocodec"] = "opus"
        // // to force Opus as the audio codec to use, or:
        // // 		publish["videocodec"] = "vp9"
        // // to force VP9 as the videocodec to use. In both case, though, forcing
        // // a codec will only work if: (1) the codec is actually in the SDP (and
        // // so the browser supports it), and (2) the codec is in the list of
        // // allowed codecs in a room. With respect to the point (2) above,
        // // refer to the text in janus.plugin.videoroom.jcfg for more details.
        // // We allow people to specify a codec via query string, for demo purposes
        if (acodec) publish["audiocodec"] = acodec;
        if (vcodec) publish["videocodec"] = vcodec;
        sfutest.send({ message: publish, jsep: jsep });
      },
      error: function (error) {
        Janus.error("WebRTC error:", error);
        if (useAudio) {
          publishOwnFeed(false);
        } else {
          alert("WebRTC error... " + error.message);
          // $('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
        }
      },
    });
  }

  function newRemoteFeed(id, display, streams) {
    // setRemoteUserName(display);
    remoteUserName = display;
    console.warn(id, display, streams);
    var remoteFeed = null;
    console.warn("streams ", streams);
    if (!streams) streams = feedStreams[id];
    janus.attach({
      plugin: "janus.plugin.videoroom",
      opaqueId: opaqueId,
      success: function (pluginHandle) {
        remoteFeed = pluginHandle;
        remoteFeed.remoteTracks = {};
        remoteFeed.remoteVideos = 0;
        remoteFeed.simulcastStarted = false;
        Janus.log(
          "Plugin attached! (" +
            remoteFeed.getPlugin() +
            ", id=" +
            remoteFeed.getId() +
            ")"
        );
        Janus.log("  -- This is a subscriber");
        // Prepare the streams to subscribe to, as an array: we have the list of
        // streams the feed is publishing, so we can choose what to pick or skip
        var subscription = [];
        for (var i in streams) {
          console.error("streams ", streams[i]);
          var stream = streams[i];
          // If the publisher is VP8/VP9 and this is an older Safari, let's avoid video
          if (
            stream.type === "video" &&
            Janus.webRTCAdapter.browserDetails.browser === "safari" &&
            (stream.codec === "vp9" ||
              (stream.codec === "vp8" && !Janus.safariVp8))
          ) {
            console.warn(
              "Publisher is using " +
                stream.codec.toUpperCase +
                ", but Safari doesn't support it: disabling video stream #" +
                stream.mindex
            );
            continue;
          }
          subscription.push({
            feed: stream.id, // This is mandatory
            mid: stream.mid, // This is optional (all streams, if missing)
          });
          // FIXME Right now, this is always the same feed: in the future, it won't
          remoteFeed.rfid = stream.id;
          remoteFeed.rfdisplay = escapeXmlTags(stream.display);
        }
        // We wait for the plugin to send us an offer
        var subscribe = {
          request: "join",
          room: parseInt(customRoomIdRef.current.value),
          // room: parseInt(myroom),
          ptype: "subscriber",
          streams: subscription,
          use_msid: use_msid,
          private_id: mypvtid,
        };
        remoteFeed.send({ message: subscribe });
      },
      error: function (error) {
        Janus.error("  -- Error attaching plugin...", error);
        alert("Error attaching plugin... " + error);
      },
      iceState: function (state) {
        Janus.log(
          "ICE state (feed #" + remoteFeed.rfindex + ") changed to " + state
        );
      },
      webrtcState: function (on) {
        Janus.log(
          "Janus says this WebRTC PeerConnection (feed #" +
            remoteFeed.rfindex +
            ") is " +
            (on ? "up" : "down") +
            " now"
        );
      },
      slowLink: function (uplink, lost, mid) {
        Janus.warn(
          "Janus reports problems " +
            (uplink ? "sending" : "receiving") +
            " packets on mid " +
            mid +
            " (" +
            lost +
            " lost packets)"
        );
      },
      onmessage: function (msg, jsep) {
        Janus.debug(" ::: Got a message (subscriber) :::", msg);
        var event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if (msg["error"]) {
          alert(msg["error"]);
        } else if (event) {
          if (event === "attached") {
            // Subscriber created and attached
            for (var i = 1; i < 6; i++) {
              if (!feeds[i]) {
                feeds[i] = remoteFeed;
                remoteFeed.rfindex = i;
                break;
              }
            }
            // if(!remoteFeed.spinner) {
            //   var target = document.getElementById('videoremote'+remoteFeed.rfindex);
            //   remoteFeed.spinner = new Spinner({top:100}).spin(target);
            // } else {
            //   remoteFeed.spinner.spin();
            // }
            Janus.log("Successfully attached to feed in room " + msg["room"]);
            // $('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
          } else if (event === "event") {
            // Check if we got a simulcast-related event from this publisher
            var substream = msg["substream"];
            var temporal = msg["temporal"];
            if (
              (substream !== null && substream !== undefined) ||
              (temporal !== null && temporal !== undefined)
            ) {
              if (!remoteFeed.simulcastStarted) {
                remoteFeed.simulcastStarted = true;
                // Add some new buttons
                // addSimulcastButtons(remoteFeed.rfindex, true);
              }
              // We just received notice that there's been a switch, update the buttons
              // updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
            }
          } else {
            // What has just happened?
          }
        }
        if (jsep) {
          Janus.debug("Handling SDP as well...", jsep);
          var stereo = jsep.sdp.indexOf("stereo=1") !== -1;

          // Answer and attach
          remoteFeed.createAnswer({
            jsep: jsep,
            // We only specify data channels here, as this way in
            // case they were offered we'll enable them. Since we
            // don't mention audio or video tracks, we autoaccept them
            // as recvonly (since we won't capture anything ourselves)
            tracks: [{ type: "data" }],
            customizeSdp: function (jsep) {
              if (stereo && jsep.sdp.indexOf("stereo=1") == -1) {
                // Make sure that our offer contains stereo too
                jsep.sdp = jsep.sdp.replace(
                  "useinbandfec=1",
                  "useinbandfec=1;stereo=1"
                );
              }
            },
            success: function (jsep) {
              Janus.debug("Got SDP!", jsep);
              var body = {
                request: "start",
                room: parseInt(customRoomIdRef.current.value),
              };
              // var body = { request: "start", room: parseInt(myroom) };
              remoteFeed.send({ message: body, jsep: jsep });
            },
            error: function (error) {
              Janus.error("WebRTC error:", error);
              alert("WebRTC error... " + error.message);
            },
          });
        }
      },
      onlocaltrack: function (track, on) {
        // The subscriber stream is recvonly, we don't expect anything here
      },
      onremotetrack: function (track, mid, on) {
        Janus.debug(
          "Remote feed #" +
            remoteFeed.rfindex +
            ", remote track (mid=" +
            mid +
            ") " +
            (on ? "added" : "removed") +
            ":",
          track
        );
        if (!on) {
          // Track removed, get rid of the stream and the rendering
          // $('#remotevideo'+remoteFeed.rfindex + '-' + mid).remove();
          if (track.kind === "video") {
            remoteFeed.remoteVideos--;
            if (remoteFeed.remoteVideos === 0) {
              // No video, at least for now: show a placeholder
              // if($('#videoremote'+remoteFeed.rfindex + ' .no-video-container').length === 0) {
              //   $('#videoremote'+remoteFeed.rfindex).append(
              //     '<div class="no-video-container">' +
              //       '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
              //       '<span class="no-video-text">No remote video available</span>' +
              //     '</div>');
              // }
              console.log(
                "Track removed, get rid of the stream and the rendering"
              );
            }
          }
          delete remoteFeed.remoteTracks[mid];
          return;
        }
        // If we're here, a new track was added
        if (remoteFeed.spinner) {
          remoteFeed.spinner.stop();
          remoteFeed.spinner = null;
        }
        // if($('#remotevideo' + remoteFeed.rfindex + '-' + mid).length > 0)
        // 	return;
        // if (
        //   document.getElementById(`#remotevideo-${remoteFeed.rfindex}-${mid}`)
        //     .length > 0
        // )
        //   return;

        if (track.kind === "audio") {
          // New audio track: create a stream out of it, and use a hidden <audio> element
          let stream = new MediaStream([track]);
          remoteFeed.remoteTracks[mid] = stream;
          Janus.error("Created remote audio stream:", stream);

          // attach remote video stream
          // $('#videoremote'+remoteFeed.rfindex).append('<audio class="hide" id="remotevideo' + remoteFeed.rfindex + '-' + mid + '" autoplay playsinline/>');
          Janus.attachMediaStream(remoteAudioRef.current, stream);

          if (remoteFeed.remoteVideos === 0) {
            // No video, at least for now: show a placeholder
            // if($('#videoremote'+remoteFeed.rfindex + ' .no-video-container').length === 0) {
            // 	$('#videoremote'+remoteFeed.rfindex).append(
            // 		'<div class="no-video-container">' +
            // 			'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
            // 			'<span class="no-video-text">No remote video available</span>' +
            // 		'</div>');
            // }
          }
        } else {
          // New video track: create a stream out of it
          remoteFeed.remoteVideos++;
          console.error("remotefeed ", remoteFeed.remoteVideos);
          // $('#videoremote'+remoteFeed.rfindex + ' .no-video-container').remove();
          Janus.log([track]);
          let stream = new MediaStream([track]);
          remoteFeed.remoteTracks[mid] = stream;
          Janus.log(
            "Created remote video stream:",
            stream
          );
          // $('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered" id="remotevideo' + remoteFeed.rfindex + '-' + mid + '" width=100% autoplay playsinline/>');
          // $('#videoremote'+remoteFeed.rfindex).append(
          // 	'<span class="label label-primary hide" id="curres'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
          // 	'<span class="label label-info hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>');
          // const videoContainer = document.querySelector("#video-container");
          // const video = document.createElement("video");
          // alert('created new video element')
          // video.setAttribute("id", `remotevideo-${remoteFeed.rfindex}-${mid}`);
          // video.setAttribute("autoplay", ``);
          // video.setAttribute("playsinline", ``);
          // videoContainer.appendChild(video);
          // Janus.attachMediaStream(video, stream);
          // console.warn("stream ", stream.videoWidth);
          Janus.attachMediaStream(remoteVideoRef.current, stream);
          // Note: we'll need this for additional videos too

          if (!bitrateTimer[remoteFeed.rfindex]) {
            // $('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
            // bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
            // 	if(!$("#videoremote" + remoteFeed.rfindex + ' video').get(0))
            // 		return;
            // 	// Display updated bitrate, if supported
            // 	var bitrate = remoteFeed.getBitrate();
            // 	$('#curbitrate'+remoteFeed.rfindex).text(bitrate);
            // 	// Check if the resolution changed too
            // 	var width = $("#videoremote" + remoteFeed.rfindex + ' video').get(0).videoWidth;
            // 	var height = $("#videoremote" + remoteFeed.rfindex + ' video').get(0).videoHeight;
            // 	if(width > 0 && height > 0)
            // 		$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
            // }, 1000);
          }
        }
      },
      oncleanup: function () {
        Janus.log(
          " ::: Got a cleanup notification (remote feed " + id + ") :::"
        );
        // if(remoteFeed.spinner)
        // 	remoteFeed.spinner.stop();
        // remoteFeed.spinner = null;
        // $('#remotevideo'+remoteFeed.rfindex).remove();
        // $('#waitingvideo'+remoteFeed.rfindex).remove();
        // $('#novideo'+remoteFeed.rfindex).remove();
        // $('#curbitrate'+remoteFeed.rfindex).remove();
        // $('#curres'+remoteFeed.rfindex).remove();
        // if(bitrateTimer[remoteFeed.rfindex])
        // 	clearInterval(bitrateTimer[remoteFeed.rfindex]);
        // bitrateTimer[remoteFeed.rfindex] = null;
        // remoteFeed.simulcastStarted = false;
        // $('#simulcast'+remoteFeed.rfindex).remove();
        remoteFeed.remoteTracks = {};
        remoteFeed.remoteVideos = 0;
      },
    });
  }

  const createRoom = (roomId) => {
    let isParticipants;

    let listOfParticipants = {
      request: "listparticipants",
      room: parseInt(customRoomIdRef.current.value),
      // room: myroom,
    };

    let succes = (data) => {
      console.log(data.videoroom);
      if (data.videoroom === "participants") {
        isParticipants = data.participants.length;
        alert(isParticipants);
        if (isParticipants >= 0) {
          var register = {
            request: "join",
            room: parseInt(customRoomIdRef.current.value),
            // room: parseInt(myroom),
            ptype: "publisher",
            display: "Pratik",
          };
          myusername = escapeXmlTags("Pratik");
          sfutest.send({ message: register });
        }
      } else if (data.videoroom === "event") {
        if (data.error) {
          var createRoom = {
            request: "create",
            room: parseInt(roomId),
            // permanent: false,
            description: "first custom room",
            // is_private: true,
          };
          // myusername = escapeXmlTags(username);
          console.log("sfutest", sfutest);
          // sfutest.send({ message: createRoom });
          sfutest.send({ message: createRoom, success: succes });
        }
      } else if (data.videoroom === "created") {
        alert("room has been created", data.room);
      }
    };

    sfutest.send({ message: listOfParticipants, success: succes });

    // console.log("roomid", parseInt(roomId));
    // if (roomId === "") {
    //   alert("Insert a username to register (e.g. 4523)");
    //   return;
    // } else {
    //   var createRoom = {
    //     request: "create",
    //     room: parseInt(roomId),
    //     // permanent: false,
    //     description: "first custom room",
    //     // is_private: true,
    //   };
    //   // myusername = escapeXmlTags(username);
    //   console.log("sfutest", sfutest);
    //   sfutest.send({ message: createRoom });
    // }
  };

  const handleLeave = () => {
    let isParticipants;

    let listOfParticipants = {
      request: "listparticipants",
      room: parseInt(customRoomIdRef.current.value),
      // room: myroom,
    };

    let succes = (data) => {
      console.log(data.videoroom);
      if (data.videoroom === "participants") {
        isParticipants = data.participants.length;
        if (isParticipants === 1) {
          // alert(isParticipants)
          let destroyRoom = {
            request: "destroy",
            // room : myroom,
            secret: "adminpwd",
            room: parseInt(customRoomIdRef.current.value),
            permanent: true,
          };
          sfutest.send({ message: destroyRoom, success: succes });
          // alert('room Destroyed')
        } else {
          console.log("leaving...");
          socket.emit("user_leave", myid);
          janus.destroy();
        }
      }
    };

    sfutest.send({ message: listOfParticipants, success: succes });
  };

  const captureStream = () => {
    let stream = canvas.captureStream(30);
    console.log("stream ", stream.getVideoTracks()[0]);
    captureVideoRef.current.srcObject = stream;
  };

  const addRectangle = () => {
    console.log("adding rectangle");
    var rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: "transparent",
      width: 80,
      height: 80,
      strokeWidth: 2,
      stroke: "red",
    });
    canvas.add(rect);
    canvas.centerObject(rect);
    let acoords = rect.getCoords();
    socket.emit("coords", {
      type: "rect",
      coords: {
        tl: { x: acoords[0].x, y: acoords[0].y },
        tr: { x: acoords[1].x, y: acoords[1].y },
        bl: { x: acoords[2].x, y: acoords[2].y },
        br: { x: acoords[3].x, y: acoords[3].y },
      },
    });
  };

  // const addRectangle = () => {
  //   // create a rectangle object
  //   // canvas.remove(rect);
  //   rect.set({ strokeWidth: 2, stroke: "red" });

  //   // "add" rectangle onto canvas
  //   canvas.add(rect);
  //   // fabric.Object.prototype.transparentCorners = false;
  //   // fabric.Object.prototype.cornerColor = "blue";
  //   // fabric.Object.prototype.cornerStyle = "circle";
  //   // rect.set("selectable", true);
  //   let acoords = rect.getCoords();
  //   console.log(acoords);
  //   // canvas.setActiveObject(rect);
  //   // let active_shape = canvas.getActiveObject();
  //   // let coords = active_shape.aCoords;
  //   socket.emit("coords", {
  //     type: "rect",
  //     coords: {
  //       tl: { x: acoords[0].x, y: acoords[0].y },
  //       tr: { x: acoords[1].x, y: acoords[1].y },
  //       bl: { x: acoords[2].x, y: acoords[2].y },
  //       br: { x: acoords[3].x, y: acoords[3].y },
  //     },
  //   });
  //   console.log(canvas.getObjects().length);
  // };

  const addCircle = () => {
    console.log("adding circle");
    var circle = new fabric.Circle({
      radius: 30,
      fill: "transparent",
      left: 100,
      top: 100,
      strokeWidth: 2,
      stroke: "red",
    });
    canvas.add(circle);
    canvas.centerObject(circle);
    let acoords = circle.getCoords();
    socket.emit("coords", {
      type: "circle",
      coords: {
        tl: { x: acoords[0].x, y: acoords[0].y },
        tr: { x: acoords[1].x, y: acoords[1].y },
        bl: { x: acoords[2].x, y: acoords[2].y },
        br: { x: acoords[3].x, y: acoords[3].y },
      },
    });
  };

  // const addCircle = () => {
  //   // canvas.remove(circle);
  //   // circle = new fabric.Circle({
  //   //   radius: 30,
  //   //   fill: "transparent",
  //   //   left: 100,
  //   //   top: 100,
  //   // });
  //   circle.set({ strokeWidth: 2, stroke: "red" });
  //   canvas.centerObject(circle);
  //   canvas.add(circle);
  //   let acoords = circle.getCoords();
  //   console.log(acoords);
  //   // canvas.setActiveObject(circle);
  //   // let active_shape = canvas.getActiveObject();
  //   // let coords = active_shape.aCoords;
  //   socket.emit("coords", {
  //     type: "circle",
  //     coords: {
  //       tl: { x: acoords[0].x, y: acoords[0].y },
  //       tr: { x: acoords[1].x, y: acoords[1].y },
  //       bl: { x: acoords[2].x, y: acoords[2].y },
  //       br: { x: acoords[3].x, y: acoords[3].y },
  //     },
  //   });
  // };

  const handleRemoveObject = (e) => {
    // canvas.clear()
    // console.log(canvas.getObjects().length);
    console.log(canvas.getActiveObject().get("type"));
    let object = canvas.getActiveObject().get("type");
    canvas.remove(canvas.getActiveObject());
    socket.emit("remove_object", {
      type: object,
    });
  };

  // mute own stream mike
  const toggleMuteHandler = () => {
    var muted = sfutest.isAudioMuted();
    if (muted) {
      isMuted = true;
    } else {
      isMuted = false;
    }
    console.log(muted);
    Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
    if (muted) sfutest.unmuteAudio();
    else sfutest.muteAudio();
    muted = sfutest.isAudioMuted();
  };

  const unpublishOwnFeedHandler = () => {
    var unpublish = { request: "unpublish" };
    sfutest.send({ message: unpublish });
    setPublishOwnFeed(false);
  };

  const onPlayHandler = () => {
    console.log("w", remoteVideoRef.current.videoWidth);
    console.log(remoteVideoRef.current.videoHeight);
  };

  const zoomInHAndler = () => {
    console.log('zooming in');
    zoom = zoom + 0.1
    remoteVideoRef.current.style['transform'] =  'scale(' +zoom+ ')' 
  }

  // const input = document.querySelector("input[type=range]");
  // input.min = capabilities.zoom.min;
  // input.max = capabilities.zoom.max;
  // input.step = capabilities.zoom.step;
  // input.value = settings.zoom;

  // input.addEventListener("input", async () => {
  //   await videoTrack.applyConstraints({ advanced: [{ zoom: input.value }] });
  // });

  return (
    <div>
      <div>
        <div style={{ textAlign: "center" }}>
          <input
            type="number"
            ref={customRoomIdRef}
            placeholder="enter roomId..."
          />
          <button onClick={() => createRoom(customRoomIdRef.current.value)}>
            Create/Join Room
          </button>
          <input
            type="text"
            ref={usernameRef}
            placeholder="enter username..."
            autoFocus
          />
          <button onClick={() => registerUser(usernameRef.current.value)}>
            Register/Join Room
          </button>
          <button onClick={handleLeave}>Leave Room</button>
        </div>
        <div style={{}}>
          <div>
            <h3>local Video</h3>
            <video
              ref={localVideoRef}
              muted
              playsInline
              autoPlay
              style={{
                borderWidth: "2px",
                borderColor: "black",
                borderStyle: "solid",
                height: "300px",
                // display: "none",
              }}
            />

            <input type="range" ref={inputRef} />

            {/* bug: Changing Unmute and Mute text of button */}
            {/* <button onClick={toggleMuteHandler}>
              {isMuted ? "Unmute" : "Mute"}
            </button>
           
              <button onClick={unpublishOwnFeedHandler}>Unpublish</button>
              <button onClick={publishOwnFeed}>Publish</button> */}
          </div>
          <div style={{ height: "100%" }}>
            <div>
              <h3 style={{ margin: 0, padding: "5px", textAlign: "center" }}>
                Remote Video : <span>{remoteUserName}</span>
              </h3>
            </div>

            <div
              id="video-container"
              style={{ display: "flex", justifyContent: "center" }}
            >
              <audio ref={remoteAudioRef} autoPlay />
              <video
                id="stream"
                ref={remoteVideoRef}
                muted
                playsInline
                autoPlay
                width={1080}
                height={420}
                style={{
                  position: "absolute ",
                }}
                onPlay={onPlayHandler}
              />
              <canvas id="canvas" />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={addRectangle} style={{ position: "absolute" }}>
            Add Rectangle
          </button>
          <button onClick={handleRemoveObject} style={{ marginLeft: "300px" }}>
            Delete Shape
          </button>
          <button style={{ marginLeft: 2 }} onClick={addCircle}>
            Add Circle
          </button>
          <button style={{ marginLeft: 2 }} onClick={zoomInHAndler}>
            Zoom In
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiuserVideocall;
