/* 
####################################
############### Chat ###############
####################################
*/

const socket = io();
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
room.hidden = true;

let roomName;
function addMessage(message) {
  const ul = room.querySelector("ul");
  const li = document.createElement("li");
  li.innerHTML = message;
  ul.appendChild(li);
}

function handleMessageSubmit(e) {
  e.preventDefault();
  const input = room.querySelector("#msg input");
  const value = input.value;
  socket.emit("new_message", input.value, roomName, () => {
    addMessage(`You: ${value}`);
  });
  input.value = "";
}

function handleNicknameSubmit(e) {
  e.preventDefault();
  const input = room.querySelector("#name input");
  socket.emit("nickname", input.value);
}

function showRoom() {
  welcome.hidden = true;
  room.hidden = false;
  const h3 = room.querySelector("h3");
  h3.innerHTML = `Room ${roomName}`;
  const msgForm = room.querySelector("#msg");
  const nameForm = room.querySelector("#name");
  msgForm.addEventListener("submit", handleMessageSubmit);
  nameForm.addEventListener("submit", handleNicknameSubmit);
}

function handleRoomSubmit(e) {
  e.preventDefault();
  const input = form.querySelector("input");
  socket.emit("enter_room", input.value, showRoom);
  roomName = input.value;
  input.value = "";
}

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome", (user, newCount) => {
  const h3 = room.querySelector("h3");
  h3.innerHTML = `Room ${roomName} (${newCount})`;
  addMessage(`${user} arrived!`);
});

socket.on("bye", (user, newCount) => {
  const h3 = room.querySelector("h3");
  h3.innerHTML = `Room ${roomName} (${newCount})`;
  addMessage(`${user} left :( `);
});

socket.on("new_message", addMessage);

socket.on("room_change", (rooms) => {
  const roomList = welcome.querySelector("ul");
  roomList.innerHTML = "";
  if (rooms.length === 0) {
    return;
  }
  rooms.forEach((room) => {
    const li = document.createElement("li");
    li.innerHTML = room;
    roomList.append(li);
  });
});

/* 
####################################
############### Call ###############
####################################
*/

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName_v;
let myPeerConnection;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerHTML = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerHTML = "Unmute";
    muted = true;
  } else {
    muteBtn.innerHTML = "Mute";
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerHTML = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerHTML = "Turn Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

/* 
##########################################
############### Video Room ###############
##########################################
*/

const welcome_v = document.getElementById("welcome_v");
const welcome_vForm = welcome_v.querySelector("form");

async function initCall() {
  welcome_v.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(e) {
  e.preventDefault();
  const input = welcome_vForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName_v = input.value;
  input.value = "";
}

welcome_vForm.addEventListener("submit", handleWelcomeSubmit);

// socket
socket.on("welcome_v", async () => {
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("offer 보냄");
  socket.emit("offer", offer, roomName_v);
});

socket.on("offer", async (offer) => {
  console.log("offer 받음");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName_v);
  console.log("answer 보냄");
});

socket.on("answer", (answer) => {
  console.log("answer 받음");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("candidate 받음");
  myPeerConnection.addIceCandidate(ice);
});

// webRTC
function makeConnection() {
  myPeerConnection = new RTCPeerConnection();
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log("candidate 보냄");
  socket.emit("ice", data.candidate, roomName_v);
}

function handleAddStream(data) {
  const peerFace = document.getElementById("peerFace");
  console.log("peer한테 stream 받음");
  peerFace.srcObject = data.stream;
}
