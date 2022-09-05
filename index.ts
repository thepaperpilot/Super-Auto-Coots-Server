// TODO SSL for production (use https://github.com/thepaperpilot/Babble-Buds/blob/master/server/server.js as reference)
import { config } from "dotenv";
import { Server, Socket } from "socket.io";

// Load environment variables
config();

// Settings
const port = process.env.PORT ? parseInt(process.env.PORT) : (process.env.NODE_ENV === "production" ? 8000 : 3000);
const clientVersion = process.env.CLIENT_VERSION ?? "~0.0.0";
const logLevels: LogLevels[] = process.env.LOG_LEVELS?.split(",") as LogLevels[] ?? ["log", "warn", "error"];

export type LogLevels = "info" | "log" | "warn" | "error";

export interface Room {
  host: string;
  state: GameState;
  contentPacks: (string | ContentPack)[];
  nicknames: Record<string, string>;
  private?: boolean;
  password?: string;
}

// Set up socket io
const io = new Server<ClientToServerEvents, ServerToClientEvents>(port, {
    serveClient: false
});

const rooms: Record<string, Room> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function log(message: string, level: LogLevels = "log", data: any = undefined) {
    if (logLevels.includes(level)) {
      console[level](message, data);
    }
}

io.on("connection", function (socket) {
    log(`New Connection: ${socket.id}`);
    socket.rooms.clear();

    // Send server version, to ensure client version is compatible
    socket.emit("server version", clientVersion);

    // Add Application Listeners
    socket.on("get rooms", () => {
        socket.emit("set rooms", Object.keys(rooms).filter(r => rooms[r].private !== true).map(r => ({
            name: r,
            host: rooms[r].nicknames[rooms[r].host],
            hasPassword: !!rooms[r].password
        })));
    });
    socket.on("create room", ({ name, password, privateRoom, contentPacks, state, nickname }) => {
        name = name + "-room";
        if (name in rooms) {
            socket.emit("info", "Cannot create room with that name");
            return;
        }

        if (socket.rooms.size > 0) {
            socket.emit("info", "Cannot create room while already in room");
            return;
        }

        log(`{${nickname} created new room ${name}`);

        rooms[name] = {
            host: socket.id,
            password,
            private: privateRoom,
            contentPacks,
            state,
            nicknames: { [socket.id]: nickname }
        }

        void socket.join(name);
    });
    socket.on("connect to room", async (name: string, password: string | undefined, nickname: string) => {
        if (name === "") {
            socket.emit("info", "Cannot join room");
            return;
        }

        name = name + "-room";

        if (socket.rooms.size > 0) {
            socket.emit("info", "Already in a room");
            return;
        }

        if (!(name in rooms)) {
            socket.emit("info", "Cannot join room that doesn't exist");
            return;
        }
        
        const room = rooms[name];

        if (room.password !== password) {
            socket.emit("info", "Cannot join room with incorrect password");
            return;
        }

        if (Object.values(room.nicknames).includes(nickname)) {
            socket.emit("info", "Cannot join room with already taken nickname");
            return;
        }
        
        log(`${nickname} joined room ${name}`);

        await socket.join(name);
        socket.emit("set content packs", room.contentPacks);
        socket.emit("set game state", room.state);
        room.nicknames[socket.id] = nickname;
        socket.emit("set nicknames", Object.values(room.nicknames));
    });
    socket.on("leave room", () => {
        leaveRoom(socket);
    });
    socket.on("kick user", (id: string) => {        
        const [room] = socket.rooms;

        if (!socket.rooms.has(room) || !(room in rooms)) {
            socket.emit("info", "Cannot kick user when not in a room");
            return;
        }

        if (rooms[room].host !== socket.id) {
            socket.emit("info", "Cannot kick user when not host");
            return;
        }

        if (id == socket.id) {
            socket.emit("info", "Cannot kick yourself");
            return;
        }

        const socketToKick = io.sockets.sockets.get(id);

        if (socketToKick == undefined) {
            socket.emit("info", "Cannot kick user that doesn't exist");
            return;
        }
        
        if (socketToKick.rooms.has(room)) {
            socket.emit("info", "Cannot kick user that isn't in your room");
            return;
        }

        leaveRoom(socketToKick);
    });
    socket.on("accept", state => {
        const [room] = socket.rooms;

        if (!socket.rooms.has(room) || !(room in rooms)) {
            log("Ignoring event due to not being in room", "info");
            return;
        }

        if (rooms[room].host !== socket.id) {
            log("Ignoring event due to not being host", "info");
        }

        io.to(room).emit("set game state", state);
    });
    socket.on("reject", (id, state) => {
        const [room] = socket.rooms;

        if (!socket.rooms.has(room) || !(room in rooms)) {
            log("Ignoring event due to not being in room", "info");
            return;
        }

        if (rooms[room].host !== socket.id) {
            log("Ignoring event due to not being host", "info");
        }

        if (id == socket.id) {
            // no-op
            return;
        }

        const socketToReject = io.sockets.sockets.get(id);

        if (socketToReject == undefined) {
            log("Ignoring event due to user not existing", "info")
            return;
        }
        
        if (socketToReject.rooms.has(room)) {
            log("Ignoring event due to user no longer being in room", "info")
            return;
        }

        socketToReject.emit("info", "Action rejected by the server. Try again in a few moments");
        socketToReject.emit("set game state", state);
    });
    setupBroadcastPassthrough(socket, "set cursor position");
    setupBroadcastPassthrough(socket, "chat");
    setupBroadcastPassthroughIfHost(socket, "set content packs");
    setupBroadcastPassthroughIfHost(socket, "set game state");
    setupSendingToHost(socket, "move node");
    setupSendingToHost(socket, "connect nodes");

    socket.on("disconnecting", () => {
        leaveRoom(socket);
    });
    socket.on("disconnect", () => {
        log(socket.id + " disconnected.");
    });
});

function leaveRoom(socket: Socket) {
    const [room] = socket.rooms;

    if (!socket.rooms.has(room) || !(room in rooms)) {
        // Not in a room
        return;
    }

    const nickname = rooms[room].nicknames[socket.id];
    log(`${nickname} left their room`);

    if (rooms[room].host === socket.id) {
        log(`Closing room: ${room}`);
        io.to(room).socketsLeave(room);
        delete rooms[room];
    } else {
        delete rooms[room].nicknames[socket.id];
        socket.to(room).emit("set nicknames", Object.values(rooms[room].nicknames));
        socket.leave(room);
    }
}

function setupBroadcastPassthrough(socket: Socket, event: keyof ServerToClientEvents) {
    socket.on(event, (...args) => {
        const [room] = socket.rooms;

        if (!socket.rooms.has(room) || !(room in rooms)) {
            log("Ignoring event due to not being in room", "info", { event, args });
            return;
        }

        const nickname = rooms[room].nicknames[socket.id];
        // @ts-ignore
        io.to(room).emit(event, nickname, ...args);
    });
}

function setupBroadcastPassthroughIfHost(socket: Socket, event: keyof ServerToClientEvents) {
    socket.on(event, (...args) => {
        const [room] = socket.rooms;

        if (!socket.rooms.has(room) || !(room in rooms)) {
            log("Ignoring event due to not being in room", "info", { event, args });
            return;
        }

        if (rooms[room].host !== socket.id) {
            log("Ignoring event due to not being host", "info", { event, args });
        }

        const nickname = rooms[room].nicknames[socket.id];
        // @ts-ignore
        io.to(room).emit(event, nickname, ...args);
    });
}

function setupSendingToHost(socket: Socket, event: keyof ServerToClientEvents) {
    socket.on(event, (...args) => {
        const [room] = socket.rooms;

        if (!socket.rooms.has(room) || !(room in rooms)) {
            log("Ignoring event due to not being in room", "info", { event, args });
            return;
        }

        if (rooms[room].host === socket.id) {
            log("Ignoring event due to being host", "info", { event, args });
        }

        const nickname = rooms[room].nicknames[socket.id];
        // @ts-ignore
        io.sockets.sockets.get(rooms[room].host)?.emit(event, nickname, ...args);
    });
}
