import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fabric } from "fabric";

import { io } from "socket.io-client";

import Janus from "../../src/janus/janus.js";
import { server, iceServers } from "../../src/janus/setting.js";

var janus = null;
var sfutest = null;
var opaqueId = "videoroom-" + Janus.randomString(12);

var myroom = 5678; // Demo room

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

var canvas;

const MultiuserVideocall = () => {
  // const location = useLocation();

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
  const [remoteUserName, setRemoteUserName] = useState("");
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

  // recording essentials
  var acodec =
    getQueryStringValue("acodec") !== "" ? getQueryStringValue("acodec") : null;
  var vcodec =
    getQueryStringValue("vcodec") !== "" ? getQueryStringValue("vcodec") : null;
  var vprofile =
    getQueryStringValue("vprofile") !== ""
      ? getQueryStringValue("vprofile")
      : null;
  var doSimulcast =
    getQueryStringValue("simulcast") === "yes" ||
    getQueryStringValue("simulcast") === "true";
  var doOpusred =
    getQueryStringValue("opusred") === "yes" ||
    getQueryStringValue("opusred") === "true";

  var recordData =
    getQueryStringValue("data") !== "" ? getQueryStringValue("data") : null;

  let socket = io.connect("http://65.1.95.72:3001/");

  useEffect(() => {
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
      width: 1280,
      height: 670,
    });
  }, []);

  useEffect(() => {
    canvas.on({
      "object:modified": function (e) {
        console.log(canvas.getObjects().length);
        console.log(e.target.get("type"));
        let active_shape = canvas.getActiveObject();
        let coords = active_shape.aCoords;
        let type = e.target.get("type");
        console.log(active_shape);
        socket.emit("coords", { type, coords });
      },
    });
  }, []);

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
            console.log(msg);
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
                  // subscriber mode
                } else {
                  publishOwnFeed(true);
                }
                if (msg["publishers"].length !== 0) {
                  setRemoteUserName(msg["publishers"][0].display);
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
                  setRemoteUserName("");
                  alert(`user left`);
                  canvas.clear();
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
                    console.warn("#remote" + remoteFeed.rfindex);
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
                    console.warn("#remote" + remoteFeed.rfindex);
                    console.warn("#videoremote" + remoteFeed.rfindex);
                    feeds[remoteFeed.rfindex] = null;
                    remoteFeed.detach();
                  }
                  delete feedStreams[unpublished];
                } else if (msg["error"]) {
                  if (msg["error_code"] === 426) {
                    alert(
                      "<p>Apparently room <code>" +
                        myroom +
                        "</code> (the one this demo uses as a test room) " +
                        "does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
                        "configuration file? If not, make sure you copy the details of room <code>" +
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
              sfutest.handleRemoteJsep({ jsep: jsep });

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
              }
            }
          },
          onlocaltrack: function (track, on) {
            Janus.log("Local track " + (on ? "added" : "removed") + ":", track);

            var trackId = track.id.replace(/[{}]/g, "");
            if (!on) {
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
                localVideos--;
                if (localVideos === 0) {
                  // No video, at least for now: show a placeholder
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
              }
            } else {
              // New video track: create a stream out of it
              localVideos++;
              stream = new MediaStream([track]);
              localTracks[trackId] = stream;
              Janus.log("Created local stream:", stream);

              Janus.attachMediaStream(localVideoRef.current, stream);
            }
            if (
              sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
              sfutest.webrtcStuff.pc.iceConnectionState !== "connected"
            ) {
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
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");

    let results = "";
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
        // room: parseInt(customRoomIdRef.current.value),
        room: parseInt(myroom),
        ptype: "publisher",
        display: username,
      };
      const succes = () => {
        console.log("iiii");
      };
      myusername = escapeXmlTags(username);
      sfutest.send({ message: register, success: succes });
    }
  };

  function publishOwnFeed(useAudio) {
    let tracks = [];
    if (useAudio) tracks.push({ type: "audio", capture: true, recv: false });
    tracks.push({
      type: "video",
      capture: true,
      recv: false,
      simulcast: doSimulcast,
    });

    console.log("get tracks ", tracks);
    sfutest.createOffer({
      tracks: tracks,
      customizeSdp: function (jsep) {
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
        }
      },
    });
  }

  function newRemoteFeed(id, display, streams) {
    // setRemoteUserName(display);
    console.warn(id, display, streams);
    setRemoteUserName(display);
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

        var subscription = [];
        for (var i in streams) {
          console.error("streams ", streams[i]);
          var stream = streams[i];
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
          remoteFeed.rfid = stream.id;
          remoteFeed.rfdisplay = escapeXmlTags(stream.display);
        }
        var subscribe = {
          request: "join",
          // room: parseInt(customRoomIdRef.current.value),
          room: parseInt(myroom),
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
            Janus.log("Successfully attached to feed in room " + msg["room"]);
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
              }
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
                // room: parseInt(customRoomIdRef.current.value),
              };
              var body = { request: "start", room: parseInt(myroom) };
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
          if (track.kind === "video") {
            remoteFeed.remoteVideos--;
            if (remoteFeed.remoteVideos === 0) {
              // No video, at least for now: show a placeholder
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

        if (track.kind === "audio") {
          // New audio track: create a stream out of it, and use a hidden <audio> element
          let stream = new MediaStream([track]);
          remoteFeed.remoteTracks[mid] = stream;
          Janus.error("Created remote audio stream:", stream);

          // attach remote video stream
          Janus.attachMediaStream(remoteAudioRef.current, stream);

          if (remoteFeed.remoteVideos === 0) {
            // No video, at least for now: show a placeholder
          }
        } else {
          // New video track: create a stream out of it
          remoteFeed.remoteVideos++;
          console.error("remotefeed ", remoteFeed.remoteVideos);
          Janus.log([track]);
          let stream = new MediaStream([track]);
          remoteFeed.remoteTracks[mid] = stream;
          Janus.log("Created remote video stream:", stream);
          Janus.attachMediaStream(remoteVideoRef.current, stream);
          // Note: we'll need this for additional videos too

          if (!bitrateTimer[remoteFeed.rfindex]) {
            // show bitrateTimer
          }
        }
      },
      oncleanup: function () {
        Janus.log(
          " ::: Got a cleanup notification (remote feed " + id + ") :::"
        );
        remoteFeed.remoteTracks = {};
        remoteFeed.remoteVideos = 0;
      },
    });
  }

  const createRoom = (roomId) => {
    let isParticipants;

    let listOfParticipants = {
      request: "listparticipants",
      // room: parseInt(customRoomIdRef.current.value),
      room: myroom,
    };

    let succes = (data) => {
      console.log(data.videoroom);
      if (data.videoroom === "participants") {
        isParticipants = data.participants.length;
        alert(isParticipants);
        if (isParticipants >= 0) {
          var register = {
            request: "join",
            // room: parseInt(customRoomIdRef.current.value),
            room: parseInt(myroom),
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
          console.log("sfutest", sfutest);
          sfutest.send({ message: createRoom, success: succes });
        }
      } else if (data.videoroom === "created") {
        alert("room has been created", data.room);
      }
    };

    sfutest.send({ message: listOfParticipants, success: succes });
  };

  const handleLeave = () => {
    let isParticipants;

    let listOfParticipants = {
      request: "listparticipants",
      // room: parseInt(customRoomIdRef.current.value),
      room: myroom,
    };

    let succes = (data) => {
      console.log(data.videoroom);
      if (data.videoroom === "participants") {
        isParticipants = data.participants.length;
        if (isParticipants === 1) {
          // alert(isParticipants)
          let destroyRoom = {
            request: "destroy",
            room: myroom,
            secret: "adminpwd",
            // room: parseInt(customRoomIdRef.current.value),
            permanent: true,
          };
          sfutest.send({ message: destroyRoom, success: succes });
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
    if (canvas.getObjects().filter((obj) => obj.type === "rect").length > 0) {
      console.log("more objects");
      return;
    }
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

  const addCircle = () => {
    console.log("adding circle");
    if (canvas.getObjects().filter((obj) => obj.type === "circle").length > 0) {
      console.log("more objects");
      return;
    }
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

  const handleRemoveObject = (e) => {
    try {
      console.log(canvas.getActiveObject().get("type"));
      let object = canvas.getActiveObject().get("type");
      canvas.remove(canvas.getActiveObject());
      socket.emit("remove_object", {
        type: object,
      });
    } catch {
      alert("Please select shape.");
    }
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

  return (
    <div>
      <div>
        <div style={{ textAlign: "center" }}>
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
            {/* <h3>local Video</h3> */}
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
                display: "none",
              }}
            />
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
                width={1280}
                height={670}
                style={{
                  position: "absolute ",
                  backgroundColor: "rgb(80, 78, 78)",
                }}
                onPlay={onPlayHandler}
              />
              <canvas id="canvas" style={{ position: "absolute" }} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={addRectangle}>Add Rectangle</button>
          <button style={{ marginLeft: 2 }} onClick={addCircle}>
            Add Circle
          </button>
          <button onClick={handleRemoveObject} style={{ marginLeft: 2 }}>
            Delete Shape
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiuserVideocall;
