import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");

app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    Credential: true,
  },
});
instrument(io, {
  auth: false,
});

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = io;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
}

function countRoom(roomName) {
  return io.sockets.adapter.rooms.get(roomName)?.size;
}

io.on("connection", (socket) => {
  socket["nickname"] = "Anonymous";
  socket.onAny((e) => {
    console.log(`Socket Event:${e}`);
  });
  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    done();
    socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
    io.sockets.emit("room_change", publicRooms());
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
    );
  });
  socket.on("disconnect", () => {
    io.sockets.emit("room_change", publicRooms());
  });
  socket.on("new_message", (msg, room, done) => {
    socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
    done();
  });
  socket.on("nickname", (nickname) => {
    socket["nickname"] = nickname;
  });
  // video
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome_v");
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});

httpServer.listen(3000, handleListen);
