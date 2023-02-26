// TODO SSL for production (use https://github.com/thepaperpilot/Babble-Buds/blob/master/server/server.js as reference)
import { Server, Socket } from "socket.io";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { AbilityTypes, CharacterInfo, Character, SocketData, SocketType, ClientToServerEvents, ServerToClientEvents, BattleOutcome, StreamTypes } from "./types";

/* eslint-disable import/first */
require('dotenv').config();

// Settings
const port = process.env.PORT ? parseInt(process.env.PORT) : (process.env.NODE_ENV === "production" ? 8000 : 3000);
const clientVersion = process.env.CLIENT_VERSION ?? "~0.0.0";
const logLevels: LogLevels[] = process.env.LOG_LEVELS?.split(",") as LogLevels[] ?? ["log", "warn", "error"];

export type LogLevels = "info" | "log" | "warn" | "error";

// Set up socket io
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(port, {
    serveClient: false,
    cors: {
        origin: "https://www.thepaperpilot.org"
    }
});

export const characters: Record<string, CharacterInfo> = {
    // Tier 1
    coots: {
        nickname: "Coots",
        initialRelevancy: 3,
        initialPresence: 1,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const damage = char.exp >= 6 ? 6 : char.exp >= 3 ? 4 : 2;
            battle.streamers.forEach(s => (s.relevancy -= damage));
            battle.enemyStreamers.forEach(s => (s.relevancy -= damage));
        }
    },
    ludwig: {
        nickname: "Ludwig Coots",
        initialRelevancy: 2,
        initialPresence: 1,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const presenceGain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            if (battle.streamers.includes(char)) {
                char.presence += presenceGain * battle.streamers.length;
            } else {
                char.presence += presenceGain * battle.enemyStreamers.length;
            }
        }
    },
    qt: {
        nickname: "Qt Coots",
        initialRelevancy: 1,
        initialPresence: 2,
        abilityType: "Sold",
        performAbility(socket, char) {
            const goldGain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            socket.data.money = (socket.data.money ?? 0) + goldGain;
        }
    },
    mario: {
        nickname: "Mario Coots",
        initialPresence: 1,
        initialRelevancy: 1,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const damage = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            let opposingTeam: Character[];
            if (battle.streamers.includes(char)) {
                opposingTeam = battle.enemyStreamers;
            } else {
                opposingTeam = battle.streamers;
            }
            for (let i = 0; i < 2 && i < opposingTeam.length; i++) {
                opposingTeam[i].presence -= damage;
                hurt(opposingTeam[i], battle.queue);
            }
        }
    },
    aimen: {
        nickname: "Aimen Coots",
        initialPresence: 1,
        initialRelevancy: 2,
        abilityType: "Sold",
        performAbility(socket, char) {
            const team = (socket.data.team ?? []).filter((m: Character | null) => m != null);
            if (team.length === 0) {
                return;
            }
            const relevancyGain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            team[team.length - 1]!.relevancy += relevancyGain;
        }
    },
    nick: {
        nickname: "Nick Coots",
        initialPresence: 2,
        initialRelevancy: 1,
        abilityType: "LivestreamEnded",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const gain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            if (battle.streamers.includes(char)) {
                battle.streamers.forEach(s => (s.presence += gain));
            } else {
                battle.enemyStreamers.forEach(s => (s.presence += gain));
            }
        }
    },
    // Tier 2
    maid: {
        nickname: "Maid Coots",
        initialRelevancy: 2,
        initialPresence: 2,
        abilityType: "LevelUp",
        performAbility(socket, char) {
            const statGain = char.exp >= 6 ? 2 : 1;
            socket.data.team!.forEach(char => {
                if (char) {
                    char.relevancy += statGain;
                    char.presence += statGain;
                }
            });
        }
    },
    mail: {
        nickname: "Mogul Mail Coots",
        initialRelevancy: 1,
        initialPresence: 1,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const level = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            const newChar = {
                type: "ludwig",
                exp: level === 3 ? 6 : level === 2 ? 3 : 1,
                presence: char.presence,
                relevancy: char.relevancy
            };
            battle.queue.push({ action: "LivestreamJoined", target: newChar });
            if (battle.streamers.includes(char)) {
                battle.streamers.push(newChar);
            } else {
                battle.enemyStreamers.push(newChar);
            }
        }
    },
    stanz: {
        nickname: "Stanz Coots",
        initialRelevancy: 1,
        initialPresence: 1,
        abilityType: "LivestreamEnded",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const relevancyGain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            char.relevancy +=
                relevancyGain *
                (battle.streamers.filter(m => m.relevancy < char.relevancy).length +
                    battle.enemyStreamers.filter(m => m.relevancy < char.relevancy)
                        .length);
        }
    },
    chessbox: {
        nickname: "Chessboxing Coots",
        initialRelevancy: 3,
        initialPresence: 2,
        abilityType: "StreamStarted",
        performAbility(socket, char) {
            const gain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            const temp = char.relevancy + gain;
            char.relevancy = char.presence;
            char.presence = temp;
        }
    },
    hasan: {
        nickname: "Hasan Coots",
        initialRelevancy: 2,
        initialPresence: 3,
        abilityType: "StartTurn",
        performAbility(socket, char) {
            if ((socket.data.lastOutcome ?? "") !== "Victory") {
                return;
            }
            const gain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            socket.data.team?.forEach(m => {
                if (m != null) {
                    m.relevancy += gain;
                }
            });
        }
    },
    beast: {
        nickname: "Mr.Beast Coots",
        initialRelevancy: 2,
        initialPresence: 2,
        abilityType: "StartTurn",
        performAbility(socket, char) {
            const gain = char.exp >= 6 ? 6 : char.exp >= 3 ? 4 : 2;
            socket.data.money = (socket.data.money ?? 0) + gain;
        }
    },
    frog: {
        nickname: "Frog Coots",
        initialRelevancy: 1,
        initialPresence: 2,
        abilityType: "Faint",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const level = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            const newChar = {
                type: "mail",
                exp: level === 3 ? 6 : level === 2 ? 3 : 1,
                presence: char.presence,
                relevancy: char.relevancy
            };
            battle.queue.push({ action: "LivestreamJoined", target: newChar });
            if (battle.streamers.includes(char)) {
                battle.streamers.push(newChar);
            } else {
                battle.enemyStreamers.push(newChar);
            }
        }
    },
    moves: {
        nickname: "Mogul Moves Coots",
        initialRelevancy: 1,
        initialPresence: 2,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const gain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            if (battle.streamers.includes(char)) {
                char.relevancy += gain * (socket.data.wins ?? 0);
            } else {
                char.relevancy += gain * (battle.enemySocketData.wins ?? 0);
            }
        }
    },
    // Tier 3
    money: {
        nickname: "Mogul Money Coots",
        initialRelevancy: 1,
        initialPresence: 1,
        abilityType: "StreamStarted",
        performAbility(socket, char) {
            if ((socket.data.money ?? 0) >= 2) {
                const presenceGain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
                char.presence += presenceGain;
            }
        }
    },
    vespa: {
        nickname: "Vespa Coots",
        initialRelevancy: 1,
        initialPresence: 1,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            if (battle.streamers.includes(char)) {
                if (battle.enemyStreamers.length > 0) {
                    battle.enemyStreamers[
                        battle.enemyStreamers.length - 1
                    ].presence = 0;
                }
            } else {
                if (battle.streamers.length > 0) {
                    battle.streamers[
                        battle.streamers.length - 1
                    ].presence = 0;
                }
            }
        }
    },
    smash: {
        nickname: "Smash Coots",
        initialRelevancy: 2,
        initialPresence: 4,
        abilityType: "Hurt",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const gain = char.exp >= 6 ? 6 : char.exp >= 3 ? 4 : 2;
            char.relevancy += gain;
        }
    },
    connor: {
        nickname: "CDawgVA Coots",
        initialRelevancy: 2,
        initialPresence: 2,
        abilityType: "Faint",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const level = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            const newChar = {
                type: "ironmouse",
                exp: level === 3 ? 6 : level === 2 ? 3 : 1,
                presence: characters.ironmouse.initialPresence,
                relevancy: characters.ironmouse.initialRelevancy
            };
            battle.queue.push({ action: "LivestreamJoined", target: newChar });
            if (battle.streamers.includes(char)) {
                battle.streamers.push(newChar);
            } else {
                battle.enemyStreamers.push(newChar);
            }
        }
    },
    luddy: {
        nickname: "Luddy Coots",
        initialRelevancy: 2,
        initialPresence: 3,
        abilityType: "LivestreamEnded",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            if (battle.streamers.includes(char)) {
                const m = battle.enemyStreamers.reduce((a, b) => {
                    if (a.presence > b.presence) {
                        return a;
                    }
                    return b;
                });
                if (m != null) {
                    m.presence -= 3;
                    hurt(m, battle.queue);
                }
            } else {
                const m = battle.streamers.reduce((a, b) => {
                    if (a.presence > b.presence) {
                        return a;
                    }
                    return b;
                });
                if (m != null) {
                    m.presence -= 3;
                    hurt(m, battle.queue);
                }
            }
        }
    },
    slime: {
        nickname: "Slime Coots",
        initialRelevancy: 3,
        initialPresence: 3,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const gain = char.exp >= 6 ? 4 : char.exp >= 3 ? 3 : 2;
            if (battle.streamers.includes(char)) {
                if (battle.streamers.length > 1) {
                    battle.streamers[1].relevancy += gain;
                    battle.streamers[1].presence += gain;
                }
            } else {
                if (battle.enemyStreamers.length > 1) {
                    battle.enemyStreamers[1].relevancy += gain;
                    battle.enemyStreamers[1].presence += gain;
                }
            }
        }
    },
    awards: {
        nickname: "Streamer Awards Coots",
        initialRelevancy: 3,
        initialPresence: 3,
        abilityType: "StartTurn",
        performAbility(socket, char) {
            if (socket.data.lastOutcome !== "Victory") {
                return;
            }
            const gain = char.exp >= 6 ? 3 : char.exp >= 3 ? 2 : 1;
            socket.data.money = (socket.data.money ?? 0) + gain * (socket.data.wins ?? 0);
        }
    },
    // Other
    ironmouse: {
        nickname: "Ironmouse Coots",
        initialRelevancy: 5,
        initialPresence: 5,
        abilityType: "LivestreamJoined",
        performAbility(socket, char, battle) {
            if (battle == null) {
                return;
            }
            const gain = char.exp >= 6 ? 6 : char.exp >= 3 ? 4 : 2;
            char.relevancy += gain;
            char.presence += gain;
        }
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function log(message: string, level: LogLevels = "log", data: any = undefined) {
    if (logLevels.includes(level)) {
        if (data != null) {
            console[level](message, data);
        } else {
            console[level](message);
        }
    }
}

const tier1Chars = [
    "coots",
    "ludwig",
    "qt",
    "mario",
    "aimen",
    "nick"
];
const tier2Chars = [
    ...tier1Chars,
    "maid",
    "mail",
    "stanz",
    "chessbox",
    "hasan",
    "beast",
    "frog",
    "moves"
];
const tier3Chars = [
    ...tier2Chars,
    "money",
    "vespa",
    "smash",
    "connor",
    "luddy",
    "slime",
    "awards"
];

const enemyTeams: Record<number, SocketData> = {};
const waitingTeams: Record<number, () => void> = {};

const rooms: Record<string, {
    ready: SocketType[],
    firstTurn: boolean;
    password: string;
    waitingTeams: (() => void)[];
}> = {};

io.on("connection", function(socket) {
    socket.data = {
        nickname: randomName(),
        turn: 0,
        lives: 3,
        wins: 0,
        hasStreamed: false,
        team: [],
        frozen: [],
        lastOutcome: "",
        streamType: "Cooking Stream"
    };
    socket.rooms.clear();

    log(`New Connection: ${socket.id} (${socket.data.nickname})`);

    // Send server version, to ensure client version is compatible
    socket.emit("server version", clientVersion);
    socket.emit("nickname", socket.data.nickname!);

    socket.on("buy", (shopIndex, teamIndex) => {
        if (socket.data.shop?.[shopIndex] == null || (socket.data.money ?? 0) < 3 || socket.data.hasStreamed || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to buy shop item");
            return;
        }
        const type = socket.data.shop![shopIndex]!;
        if (socket.data.team?.[teamIndex] == null) {
            socket.data.team![teamIndex] = {
                type,
                relevancy: characters[type].initialRelevancy,
                presence: characters[type].initialPresence,
                exp: 1
            };
        } else if (socket.data.team?.[teamIndex]?.type === socket.data.shop![shopIndex] && (socket.data.team?.[teamIndex]?.exp ?? 0) < 6) {
            socket.data.team![teamIndex]!.relevancy++;
            socket.data.team![teamIndex]!.presence++;
            socket.data.team![teamIndex]!.exp++;
        } else {
            socket.emit("info", "Failed to buy shop item");
            return;
        }
        socket.data.shop![shopIndex] = null;
        if (socket.data.frozen!.includes(shopIndex)) {
            socket.data.frozen = socket.data.frozen!.filter(m => m !== shopIndex);
        }
        socket.emit("buy", shopIndex, teamIndex, socket.data.team![teamIndex]!);
        log(`${socket.id} purchased ${type}`, "info");
    });
    socket.on("move", (index, otherIndex) => {
        if (socket.data.team == null || socket.data.hasStreamed || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to move character");
            return;
        }
        const temp = socket.data.team![index];
        socket.data.team![index] = socket.data.team![otherIndex];
        socket.data.team![otherIndex] = temp;
        socket.emit("move", index, otherIndex);
        log(`${socket.id} moved ${temp?.type ?? socket.data.team![index]?.type ?? ""}`, "info");
    });
    socket.on("merge", (index, otherIndex) => {
        if (socket.data.team == null || socket.data.team[index] == null || socket.data.team[otherIndex] == null || socket.data.team[index]?.type !== socket.data.team[otherIndex]?.type || socket.data.team[otherIndex]!.exp >= 6 || socket.data.hasStreamed || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to merge characters");
            return;
        }
        const oldExp = socket.data.team[otherIndex]!.exp ?? 0;
        const xpToAdd = Math.min(socket.data.team[index]!.exp, 6 - oldExp);
        const oldLevel = oldExp >= 6 ? 3 : oldExp >= 3 ? 2 : 1;
        const newLevel = (oldExp + xpToAdd) >= 6 ? 3 : (oldExp + xpToAdd) >= 3 ? 2 : 1;
        socket.data.team[otherIndex]!.relevancy += xpToAdd;
        socket.data.team[otherIndex]!.presence += xpToAdd;
        socket.data.team[otherIndex]!.exp += xpToAdd;
        socket.data.team[index] = null;
        if (characters[socket.data.team[otherIndex]!.type].abilityType === "LevelUp" && oldLevel !== newLevel) {
            characters[socket.data.team[otherIndex]!.type].performAbility(socket, socket.data.team[otherIndex]!);
        }
        socket.emit("merge", index, otherIndex, socket.data.team[otherIndex]!);
        log(`${socket.id} merged two ${socket.data.team[otherIndex]!.type}`, "info");
    })
    socket.on("reroll", () => {
        if ((socket.data.money ?? 0) <= 0 || socket.data.hasStreamed || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to reroll shop");
            return;
        }
        socket.data.money!--;
        const shop = getShop(socket);
        socket.data.shop = shop;
        socket.emit("reroll", shop);
        log(`${socket.id} rerolled shop`, "info");
    });
    socket.on("stream", async () => {
        if (socket.data.team == null || socket.data.hasStreamed || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to start streaming");
            return;
        }
        socket.data.hasStreamed = true;
        if (socket.data.streamType === "Reaction Stream") {
            socket.data.team.forEach(m => {
                if (m) {
                    m.relevancy++;
                }
            })
        }
        socket.data.team.forEach(m => {
            if (m && characters[m.type].abilityType === "StreamStarted") {
                characters[m.type].performAbility(socket, m);
            }
        });
        const turn = socket.data.turn ?? 1;
        let enemyTeam: SocketData;
        if (socket.rooms.size > 0) {
            const [room] = socket.rooms;
            if (!(room in rooms)) {
                socket.emit("info", "Failed to start streaming");
                return;
            }
            if (rooms[room].ready.includes(socket)) {
                rooms[room].ready = [];
            }
            rooms[room].ready.push(socket);
            const roomSize = (await io.in(room).fetchSockets()).length;
            log(`${socket.id} waiting for rest of private room ${room} (${rooms[room].ready.length}/${roomSize})`, "info");
            if (rooms[room].ready.length >= roomSize && rooms[room].ready.length > 1) {
                rooms[room].waitingTeams.forEach(f => f());
                rooms[room].waitingTeams = [];
                rooms[room].firstTurn = false;
                log(`${room} is now battling`);
            } else {
                const promise = new Promise<void>(resolve => {
                    rooms[room].waitingTeams.push(resolve);
                })
                await promise;
            }
            enemyTeam = rooms[room].ready[(rooms[room].ready.indexOf(socket) + 1) % rooms[room].ready.length].data as SocketData;
        } else {
            if (enemyTeams[turn] == null) {
                const promise = new Promise<void>(resolve => {
                    waitingTeams[turn] = resolve;
                });
                enemyTeams[turn] = JSON.parse(JSON.stringify(socket.data));
                log(`${socket.id} waiting for opponent on turn ${turn}`);
                await promise;
            }
            enemyTeam = enemyTeams[turn];
        }
        const battleTeam: Character[] = JSON.parse(JSON.stringify(socket.data.team!.filter(m => m != null)));
        const battleEnemyTeam: Character[] = JSON.parse(JSON.stringify(enemyTeam.team.filter(m => m != null)));
        let teamStreamers: Character[] = [];
        let enemyStreamers: Character[] = [];
        let queue:
            {
                action: AbilityTypes | "join";
                target?: Character;
            }[]
            = [];
        if (socket.data.streamType === "Podcast") {
            const yards = battleTeam.filter(
                m =>
                    m != null &&
                    (m.type === "ludwig" ||
                        m.type === "nick" ||
                        m.type === "aimen" ||
                        m.type === "slime")
            );
            yards.forEach(m => {
                m.relevancy += yards.length;
            });
        } else if (socket.data.streamType === "Cooking Stream") {
            if (battleTeam.length > 0) {
                const host = battleTeam[battleTeam.length - 1];
                host.relevancy += 2;
                host.presence += 2;
            }
        } else if (socket.data.streamType === "Bro vs Bro") {
            if (battleTeam.length > 0) {
                const host = battleTeam[battleTeam.length - 1];
                host.relevancy++;
            }
            if (battleEnemyTeam.length > 0) {
                const host = battleEnemyTeam[battleEnemyTeam.length - 1];
                host.relevancy -= 2;
                hurt(host, queue);
            }
        }
        if (enemyTeam.streamType === "Podcast") {
            const yards = battleEnemyTeam.filter(
                m =>
                    m != null &&
                    (m.type === "ludwig" ||
                        m.type === "nick" ||
                        m.type === "aimen" ||
                        m.type === "slime")
            );
            yards.forEach(m => {
                m.relevancy += yards.length;
            });
        } else if (enemyTeam.streamType === "Cooking Stream") {
            if (battleEnemyTeam.length > 0) {
                const host = battleEnemyTeam[battleEnemyTeam.length - 1];
                host.relevancy += 2;
                host.presence += 2;
            }
        } else if (enemyTeam.streamType === "Bro vs Bro") {
            if (battleEnemyTeam.length > 0) {
                const host = battleEnemyTeam[battleEnemyTeam.length - 1];
                host.relevancy++;
            }
            if (battleTeam.length > 0) {
                const host = battleTeam[battleTeam.length - 1];
                host.relevancy -= 2;
                hurt(host, queue);
            }
        }
        let ranLivestreamEnded = false;
        while (queue.length > 0 || battleTeam.length > 0 || battleEnemyTeam.length > 0 || ranLivestreamEnded === false || teamStreamers.find(m => m.relevancy <= 0 || m.presence <= 0) ||
            enemyStreamers.find(m => m.relevancy <= 0 || m.presence <= 0)) {
            if (queue.length === 0) {
                if (
                    teamStreamers.find(m => m.relevancy <= 0 || m.presence <= 0) ||
                    enemyStreamers.find(m => m.relevancy <= 0 || m.presence <= 0)
                ) {
                    teamStreamers = teamStreamers.filter(
                        m => m.relevancy > 0 && m.presence > 0
                    );
                    enemyStreamers = enemyStreamers.filter(
                        m => m.relevancy > 0 && m.presence > 0
                    );
                    continue;
                } else if (battleTeam.length > 0 || battleEnemyTeam.length > 0) {
                    queue.push({ action: "join" });
                } else if (ranLivestreamEnded === false) {
                    teamStreamers.forEach(m => {
                        if (characters[m.type].abilityType === "LivestreamEnded") {
                            queue.push({ action: "LivestreamEnded", target: m });
                        }
                    });
                    enemyStreamers.forEach(m => {
                        if (characters[m.type].abilityType === "LivestreamEnded") {
                            queue.push({ action: "LivestreamEnded", target: m });
                        }
                    })
                    ranLivestreamEnded = true;
                    continue;
                } else {
                    break;
                }
            } else if (queue.length > 1) {
                queue = queue.sort((a, b) => {
                    if (a.action !== b.action) {
                        return 1;
                    }
                    if (a.target != null && b.target != null) {
                        return b.target.relevancy - a.target.relevancy;
                    }
                    return 0;
                });
            }
            const action = queue.shift()!;
            switch (action.action) {
                case "join":
                    if (battleTeam.length > 0) {
                        const char = battleTeam.pop()!;
                        teamStreamers.push(char);
                        if (characters[char.type].abilityType === "LivestreamJoined") {
                            queue.unshift({ action: "LivestreamJoined", target: char });
                        }
                    }
                    if (battleEnemyTeam.length > 0) {
                        const char = battleEnemyTeam.pop()!;
                        enemyStreamers.push(char);
                        if (characters[char.type].abilityType === "LivestreamJoined") {
                            queue.unshift({ action: "LivestreamJoined", target: char });
                        }
                    }
                    break;
                default:
                    if (action.target == null) {
                        log("Cannot perform action", "error", action);
                        break;
                    }
                    if (action.target.presence <= 0 || action.target.relevancy <= 0) {
                        break;
                    }
                    characters[action.target.type].performAbility(socket, action.target, { team: battleTeam, streamers: teamStreamers, enemyTeam: battleEnemyTeam, enemyStreamers, queue, enemySocketData: enemyTeam });
                    break;
            }
        }
        log(`Finished queue for battle for ${socket.id}`, "info", { teamStreamers, enemyStreamers });
        const score = teamStreamers.reduce((acc, curr) => acc + Math.max(0, curr.presence) * Math.max(0, curr.relevancy), 0);
        const enemyScore = enemyStreamers.reduce((acc, curr) => acc + Math.max(0, curr.presence) * Math.max(0, curr.relevancy), 0);
        const outcome = score === enemyScore ? "Tie" : score > enemyScore ? "Victory" : "Defeat";

        if (socket.rooms.size === 0) {
            enemyTeams[turn] = JSON.parse(JSON.stringify(socket.data));
            if (waitingTeams[turn]) {
                waitingTeams[turn]();
                delete waitingTeams[turn];
            }
        }
        socket.emit("stream", {
            team: enemyTeam.team.filter(m => m != null) as Character[],
            nickname: enemyTeam.nickname,
            lives: enemyTeam.lives,
            wins: enemyTeam.wins,
            turn: enemyTeam.turn,
            streamType: enemyTeam.streamType
        }, outcome);
        if (outcome === "Victory") {
            socket.data.wins = (socket.data.wins ?? 0) + 1;
        } else if (outcome === "Defeat") {
            socket.data.lives = (socket.data.lives ?? 0) - 1;
        }
        log(`${socket.id} battled ${enemyTeam.nickname} - ${outcome} (${score} vs ${enemyScore})`);
    });
    socket.on("newTurn", () => {
        if (socket.data.hasStreamed !== true || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to start new turn");
            return;
        }
        (socket.data.team ?? []).forEach(m => {
            if (m != null && characters[m.type].abilityType === "StartTurn") {
                characters[m.type].performAbility(socket, m);
            }
        });
        newTurn(socket);
    });
    socket.on("sell", (index) => {
        if (socket.data.team == null || socket.data.hasStreamed || socket.data.team[index] == null || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to sell character");
            return;
        }
        const char = socket.data.team[index]!;
        let level;
        if (char.exp >= 6) {
            level = 3;
        } else if (char.exp >= 3) {
            level = 2;
        } else {
            level = 1;
        }
        socket.data.money = (socket.data.money ?? 0) + level;
        socket.data.team[index] = null;
        if (characters[char.type].abilityType === "Sold") {
            characters[char.type].performAbility(socket, char);
        }
        socket.emit("sell", index);
        log(`${socket.id} sold ${characters[char.type].nickname}`, "info");
    });
    socket.on("freeze", index => {
        if (socket.data.shop == null || socket.data.shop[index] == null || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to freeze shop item");
            return;
        }
        if (socket.data.frozen?.includes(index)) {
            socket.data.frozen = socket.data.frozen.filter(m => m !== index);
        } else {
            socket.data.frozen?.push(index);
        }
        socket.emit("freeze", index);
    });
    socket.on("change room", async (name, password) => {
        leaveRoom(socket);
        if (name in rooms) {
            if (rooms[name].firstTurn === false) {
                socket.emit("room failed", "Private game has already started");
                return;
            }
            if (rooms[name].password !== password) {
                socket.emit("room failed", "Incorrect password");
                return;
            }
            log(`${socket.id} joined room "${name}"`, "info");
        } else {
            rooms[name] = {
                firstTurn: true,
                password,
                ready: [],
                waitingTeams: []
            };
            log(`${socket.id} created room "${name}"`);
        }
        io.to(name).emit("info", `${socket.data.nickname} has joined the room`);
        await socket.join(name);
        socket.data = {
            nickname: randomName(),
            turn: 0,
            lives: 3,
            wins: 0,
            hasStreamed: false,
            team: [],
            frozen: [],
            lastOutcome: "",
            streamType: "Cooking Stream"
        };
        socket.emit("room", name, socket.data.streamType ?? "Cooking Stream");
        newTurn(socket);
    });
    socket.on("change stream type", type => {
        if (socket.data.hasStreamed || (socket.data.money ?? 0) < 3 || socket.data.streamType === type || (socket.data.wins ?? 0) >= 5 || (socket.data.lives ?? 0) <= 0) {
            socket.emit("info", "Failed to change stream type");
            return;
        }
        socket.data.streamType = type;
        socket.data.money = (socket.data.money ?? 0) - 3;
        socket.emit("stream type", type, true);
        log(`${socket.id} switched to stream type ${type}`, "info");
    });

    socket.data.streamType = randomStreamType();
    socket.emit("stream type", socket.data.streamType ?? "Cooking Stream", false);
    newTurn(socket);

    socket.on("disconnect", () => {
        leaveRoom(socket);
        log(socket.id + " disconnected.");
    });
});

async function leaveRoom(socket: SocketType) {
    const [room] = socket.rooms;

    if (!socket.rooms.has(room) || !(room in rooms)) {
        // Not in a room
        return;
    }

    await socket.leave(room);
    rooms[room].ready = rooms[room].ready.filter(s => s !== socket);
    io.to(room).emit("info", `${socket.data.nickname} has left the room`);
    if ((await io.in(room).fetchSockets()).length === 0) {
        log(`Closing room ${room}`);
        delete rooms[room];
    }
}

function randomName(): string {
    return uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        length: 3,
        separator: " ",
        style: "capital"
    });
}

function newTurn(socket: SocketType) {
    socket.data.turn = (socket.data.turn ?? 0) + 1;
    const shop = getShop(socket);
    socket.data.shop = shop;
    if (socket.data.streamType === "Game Show") {
        socket.data.money = (socket.data.money ?? 0) + 10;
    } else {
        socket.data.money = 10;
    }
    socket.data.hasStreamed = false;
    socket.emit("newTurn", shop);
}

function hurt(char: Character, queue: { action: AbilityTypes | "join"; target?: Character; }[]) {
    if (characters[char.type].abilityType === "Hurt") {
        queue.unshift({ action: "Hurt", target: char });
    } else if (
        characters[char.type].abilityType === "Faint" &&
        (char.presence <= 0 || char.relevancy <= 0)
    ) {
        queue.unshift({ action: "Faint", target: char });
    }
}

function getShop(socket: SocketType) {
    const turn = socket.data.turn ?? 1;
    const shop: string[] = [];
    socket.data.frozen?.forEach(index => {
        shop.push(socket.data.shop![index]!);
    });
    socket.data.frozen = socket.data.frozen!.map((_, i) => i);
    let shopSize = 2;
    let shopTier = tier1Chars;
    if (turn >= 5) {
        shopSize = 4;
        shopTier = tier3Chars;
    } else if (turn >= 4) {
        shopSize = 3;
        shopTier = tier3Chars;
    } else if (turn >= 3) {
        shopSize = 3;
        shopTier = tier2Chars;
    } else if (turn >= 2) {
        shopTier = tier2Chars;
    }
    for (let i = shop.length; i < shopSize; i++) {
        shop.push(shopTier[Math.floor(Math.random() * shopTier.length)]);
    }
    return shop;
}

const streamTypes = ["Game Show", "Reaction Stream", "Podcast", "Cooking Stream", "Bro vs Bro"] as const;
function randomStreamType() {
    return streamTypes[Math.floor(Math.random() * streamTypes.length)];
}
