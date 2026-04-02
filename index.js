const express = require("express");
const cors = require("cors");
const http = require("http");
const dotenv = require("dotenv");
const { ExpressPeerServer } = require("peer");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

// Load environment variables
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

const app = express();
const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: clientUrl }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/sample", require("./routes/sampleRoutes"));
app.use("/api/rooms", require("./routes/roomRoutes"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: process.env.NODE_ENV || "development" });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  console.log(`PeerJS server available at /peerjs/myapp`);
});

// PeerJS Server — mounted at /peerjs (per docs: https://peerjs.com/server/getting-started)
const peerServer = ExpressPeerServer(server, {
  path: "/myapp",
  allow_discovery: true,
});
app.use("/peerjs", peerServer);

peerServer.on("connection", (client) => {
  console.log(`Peer connected: ${client.getId()}`);
});
peerServer.on("disconnect", (client) => {
  console.log(`Peer disconnected: ${client.getId()}`);
});

// Socket.IO for realtime chat
const io = new Server(server, {
  cors: { origin: clientUrl, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on("send-message", ({ roomId, message, sender, timestamp }) => {
    io.to(roomId).emit("receive-message", { message, sender, timestamp });
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});
