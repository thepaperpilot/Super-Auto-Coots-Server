import { Socket } from "socket.io";

type AbilityTypes = "LivestreamJoined" | "Sold" | "LevelUp" | "LivestreamEnded" | "StreamStarted" | "StartTurn" | "Hurt" | "Faint";

type StreamTypes = "Game Show" | "Reaction Stream" | "Podcast" | "Cooking Stream" | "Bro vs Bro";

type SocketData = {
    nickname: string;
    turn: number;
    lives: number;
    wins: number;
    shop: (string | null)[];
    team: (Character | null)[];
    money: number;
    hasStreamed: boolean;
    frozen: number[];
    lastOutcome: BattleOutcome | "";
    streamType: StreamTypes;
}
type SocketType = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

interface CharacterInfo {
    nickname: string;
    initialRelevancy: number;
    initialPresence: number;
    abilityType: AbilityTypes;
    performAbility: (socket: SocketType, char: Character, battle?: {
        team: Character[];
        streamers: Character[];
        enemyTeam: Character[];
        enemyStreamers: Character[];
        queue: {
            action: AbilityTypes | "join";
            target?: Character;
        }[];
        enemySocketData: SocketData;
    }) => void;
}

interface Character {
    type: string;
    relevancy: number;
    presence: number;
    exp: number;
}

type BattleOutcome = "Victory" | "Defeat" | "Tie";

interface ServerToClientEvents {
    "server version": (semver: string) => void;
    "nickname": (nickname: string) => void;
    "info": (message: string) => void;
    "newTurn": (shop: string[]) => void;
    "reroll": (shop: string[]) => void;
    buy: (shopIndex: number, teamIndex: number, char: Character) => void;
    move: (index: number, otherIndex: number) => void;
    merge: (shopIndex: number, teamIndex: number, char: Character) => void;
    stream: (
        enemy: {
            team: Character[];
            nickname: string;
            lives: number;
            wins: number;
            turn: number;
            streamType: StreamTypes;
        },
        outcome: BattleOutcome
    ) => void;
    freeze: (index: number) => void;
    sell: (index: number) => void;
    room: (room: string, streamType: StreamTypes) => void;
    "room failed": (err: string) => void;
    "stream type": (type: StreamTypes, charge: boolean) => void;
}

interface ClientToServerEvents {
    buy: (shopIndex: number, teamIndex: number) => void;
    move: (index: number, otherIndex: number) => void;
    merge: (index: number, otherIndex: number) => void;
    reroll: () => void;
    stream: () => void;
    newTurn: () => void;
    freeze: (index: number) => void;
    sell: (index: number) => void;
    "change room": (room: string, password: string) => void;
    "change stream type": (type: StreamTypes) => void;
}
