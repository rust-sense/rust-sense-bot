import type RuntimeDataStorage from '../infrastructure/RuntimeDataStorage.js';
import type GameMap from '../structures/GameMap.js';
import type Info from '../structures/Info.js';
import type MapMarkers from '../structures/MapMarkers.js';
import type RustPlusLite from '../structures/RustPlusLite.js';
import type Team from '../structures/Team.js';
import type Time from '../structures/Time.js';
import type { Timer } from '../domain/timer.js';
import type { GeneralSettings, NotificationSettings } from './instance.js';

export interface PersistedTimerData {
    id: number;
    message: string;
    endAtMs: number;
}

export interface PersistedCargoShipEgressTimer {
    id: number;
    endAtMs: number;
    x: number | null;
    y: number | null;
}

export interface PersistedCargoShipState {
    id: number;
    x: number;
    y: number;
    onItsWayOut: boolean;
}

export interface PersistedRuntimeState {
    timers?: PersistedTimerData[];
    timeSinceCargoShipWasOutMs?: number;
    timeSinceCH47WasOutMs?: number;
    timeSinceSmallOilRigWasTriggeredMs?: number;
    timeSinceLargeOilRigWasTriggeredMs?: number;
    timeSincePatrolHelicopterWasOnMapMs?: number;
    timeSincePatrolHelicopterWasDestroyedMs?: number;
    patrolHelicopterDestroyedLocation?: string;
    timeSinceTravelingVendorWasOnMapMs?: number;
    timeSinceDeepSeaSpawnedMs?: number;
    timeSinceDeepSeaWasOnMapMs?: number;
    crateSmallOilRigLocation?: string;
    crateSmallOilRigUnlockAtMs?: number;
    crateLargeOilRigLocation?: string;
    crateLargeOilRigUnlockAtMs?: number;
    cargoShipEgressTimers?: PersistedCargoShipEgressTimer[];
    cargoShipsState?: PersistedCargoShipState[];
}

export interface TimerEntry {
    timer: Timer;
    message: string;
}

export interface MarkerEntry {
    x: number;
    y: number;
    location: string;
}

export interface SubscriptionItems {
    all: string[];
    buy: string[];
    sell: string[];
}

export interface EventsLog {
    all: string[];
    cargo: string[];
    heli: string[];
    small: string[];
    large: string[];
    chinook: string[];
    travelingVendor: string[];
    deepSea: string[];
}

export interface TracerPoint {
    x: number;
    y: number;
}

export interface RustPlusState {
    serverId: string;
    guildId: string;

    isOperational: boolean;
    isDeleted: boolean;
    isNewConnection: boolean;
    isFirstPoll: boolean;
    persistentRuntimeStateRestored: boolean;
    _reconnectAttempts: number;
    _pollingInProgress: boolean;

    pollingTaskId: ReturnType<typeof setInterval> | number;
    tokensReplenishTaskId: ReturnType<typeof setInterval> | number;

    tokens: number;

    timers: Record<number, TimerEntry>;
    markers: Record<string, MarkerEntry>;
    storageMonitors: Record<string, unknown>;
    currentSwitchTimeouts: Record<string, ReturnType<typeof setTimeout>>;
    interactionSwitches: unknown[];

    passedFirstSunriseOrSunset: boolean;
    startTimeObject: Record<string, unknown>;
    informationIntervalCounter: number;
    storageMonitorIntervalCounter: number;
    smartSwitchIntervalCounter: number;
    smartAlarmIntervalCounter: number;

    messagesSentByBot: string[];
    inGameChatQueue: string[];
    inGameChatTimeout: ReturnType<typeof setTimeout> | null;

    foundSubscriptionItems: SubscriptionItems;
    currentOrderList: unknown[];
    currentOrderPage: number;
    firstPollItems: SubscriptionItems;

    allConnections: string[];
    playerConnections: Record<string, string[]>;
    allDeaths: unknown[];
    playerDeaths: Record<string, unknown[]>;
    events: EventsLog;
    patrolHelicopterTracers: Record<string | number, TracerPoint[]>;
    cargoShipTracers: Record<string | number, TracerPoint[]>;

    map: GameMap | null;
    info: Info | null;
    time: Time | null;
    team: Team | null;
    mapMarkers: MapMarkers | null;

    leaderRustPlusInstance: RustPlusLite | null;
    uptimeServer: Date | null;

    generalSettings: GeneralSettings;
    notificationSettings: NotificationSettings;
    runtimeDataStorage: RuntimeDataStorage;
}
