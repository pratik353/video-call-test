import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import useVideocallHook from "../customHooks/useVideocallHook";

import Janus from "../janus/janus";
import { server, iceServers } from "../janus/setting";

let janus;
var opaqueId = "videocalltest-" + Janus.randomString(12);
let started = false;
let sfutest = null;
let roomId = 1234;
var myusername = null;
var yourusername = null;
let videocall = false;

const RegisterUser = () => {
  const location = useLocation();

  const [userName, setUserName] = useState("");
  const [usernameToCall, setUsernameToCall] = useState("");

  const [isRegisterd, setIsRegisterd] = useState(false);

  var doSimulcast =
    getQueryStringValue("simulcast") === "yes" ||
    getQueryStringValue("simulcast") === "true";

  useEffect(() => {
    // Initialize the library (console debug enabled)
    Janus.init({
      debug: true,
      callback: function () {
        console.log("in init callback");
        janusStart();
      },
    });
  }, []);

  // Create new Janus Server
  const janusStart = () => {
    console.log("janus start");
    // calls the Janus function in janus.js file
    janus = new Janus({
      server: server,
      iceServers: iceServers,
      success: () => {
        console.log("in Janus succes function");
        janus.attach({
          plugin: "janus.plugin.videocall",
          opaqueId: opaqueId,
          // 🔥on succesfully intialization in return pluginHandle 🔥
          success: function (pluginHandle) {
            console.log("opaqueId ", opaqueId);
            console.log("plugin handles", pluginHandle);

            // attch plugin to videocall variable
            videocall = pluginHandle;
            Janus.log("videocall ", videocall);
            Janus.log(
              " video call Plugin attached! (" +
                videocall.getPlugin() +
                ", id=" +
                videocall.getId() +
                ")"
            );
          },
          error: function (error) {
            Janus.error("  -- Error attaching plugin...", error);
            alert("  -- Error attaching plugin... " + error);
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
          webrtcState: function (on) {
            Janus.log(
              "Janus says our WebRTC PeerConnection is " +
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
            Janus.debug(" ::: Got a message :::", msg);
            if (msg.error) {
              alert( msg.error)
            }
            var result = msg["result"];
            if (result) {
              if (result["list"]) {
                var list = result["list"];
                Janus.debug("Got a list of registered peers:", list);
                for (var mp in list) {
                  Janus.debug("  >> [" + list[mp] + "]");
                }
              } else if (result["event"]) {
                var event = result["event"];
                if (event === "registered") {
                  myusername = escapeXmlTags(result["username"]);
                  console.log("Successfully registered as " + myusername + "!");
                  setIsRegisterd(true);
                  // Get a list of available peers, just for fun
                  videocall.send({ message: { request: "list" } });
                  // Enable buttons to call now
                  // $("#phone").removeClass("hide").show();
                  // $("#call").unbind("click").click(doCall);
                  // $("#peer").focus();
                } else if (event === "calling") {
                  Janus.log("Waiting for the peer to answer...");
                  // TODO Any ringtone?
                  alert("Waiting for the peer to answer...");
                } else if (event === "incomingcall") {
                  // 📨 Answer call functionality 📨
                  Janus.log("Incoming call from " + result["username"] + "!");
                  yourusername = escapeXmlTags(result["username"]);
                  // Notify user
                  alert(`Incoming call from ${yourusername} !`);
                }
              }
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

  // Helper to parse query string
  function getQueryStringValue(name) {
    name = name.replace(/[[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.pathname);
    // alert(results)
    return results === null
      ? ""
      : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  const registerUsername = (username) => {
    if (username === "") {
      alert("Insert a username to register (e.g., pippo)");
    } else {
      console.log(username);
      var register = { request: "register", username: username };
      console.log("videocall ", videocall);

      // send register request to janus
      videocall.send({ message: register });
    }
  };

  const doCall = (userToCall) => {
    if (userToCall === "") {
      alert("Insert a username to register (e.g., pippo)");
    } else {
      console.log(userToCall);

      // Call this user
      videocall.createOffer({
        // We want bidirectional audio and video, plus data channels
        tracks: [
          { type: "audio", capture: true, recv: true },
          { type: "video", capture: true, recv: true, simulcast: doSimulcast },
          // { type: "data" },
        ],
        //success means createOffer({}).then() in pure webRTC
        success: function (jsep) {
          Janus.debug("Got SDP!", jsep);
          // var body = { request: "call", username: userToCall };

          // 🔥 videocall.send() same as socket.emit()  🔥
          // videocall.send({ message: body, jsep: jsep });
        },
        error: function (error) {
          Janus.error("WebRTC error...", error);
          alert("WebRTC error... " + error.message);
        },
      });
    }
  };

  return (
    <>
      <div>
        <input
          value={userName}
          placeholder={"enter your username"}
          onChange={(e) => setUserName(e.target.value)}
          autoFocus
        />
        <button onClick={() => registerUsername(userName)}>Register</button>
      </div>
      {isRegisterd && (
        <div>
          <input
            value={usernameToCall}
            placeholder={"who should we call"}
            onChange={(e) => setUsernameToCall(e.target.value)}
            autoFocus
          />
          <button onClick={() => doCall(usernameToCall)}>Call</button>
        </div>
      )}
    </>
  );
};

export default RegisterUser;
