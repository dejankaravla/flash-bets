import {
  REPLAY_SPEEDS,
  type ReplayDataset,
  type ReplaySpeed,
  type ReplayState,
} from "@/lib/replay/types";
import type { TxLineScoresUpdate } from "@/lib/types/txline";

type Timer = ReturnType<typeof setTimeout>;

export interface ReplayEngineOptions {
  dataset: ReplayDataset;
  runId: string;
  fixtureId: number;
  virtualEpochMs: number;
  emit: (update: TxLineScoresUpdate, virtualNowMs: number) => Promise<void> | void;
  onState?: (state: ReplayState) => void;
  wallNow?: () => number;
  schedule?: (callback: () => void, delayMs: number) => Timer;
  cancel?: (timer: Timer) => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export class ReplayEngine {
  private readonly dataset: ReplayDataset;
  private readonly runId: string;
  private readonly fixtureId: number;
  private readonly virtualEpochMs: number;
  private readonly emitUpdate: ReplayEngineOptions["emit"];
  private readonly onState?: ReplayEngineOptions["onState"];
  private readonly wallNow: () => number;
  private readonly scheduleTimer: NonNullable<ReplayEngineOptions["schedule"]>;
  private readonly cancelTimer: NonNullable<ReplayEngineOptions["cancel"]>;
  private readonly emissionTimes: number[];
  private timer: Timer | null = null;
  private status: ReplayState["status"] = "PAUSED";
  private speed: ReplaySpeed = 1;
  private currentTimeMs = 0;
  private baseWallMs = 0;
  private baseReplayMs = 0;
  private cursor = 0;
  private disposed = false;

  constructor(options: ReplayEngineOptions) {
    this.dataset = options.dataset;
    this.runId = options.runId;
    this.fixtureId = options.fixtureId;
    this.virtualEpochMs = options.virtualEpochMs;
    this.emitUpdate = options.emit;
    this.onState = options.onState;
    this.wallNow = options.wallNow ?? Date.now;
    this.scheduleTimer = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelTimer = options.cancel ?? clearTimeout;
    const times = new Set<number>([0, options.dataset.durationMs]);
    for (let at = options.dataset.frameIntervalMs; at < options.dataset.durationMs; at += options.dataset.frameIntervalMs) {
      times.add(at);
    }
    for (const entry of options.dataset.timeline) times.add(entry.atMs);
    this.emissionTimes = [...times].sort((left, right) => left - right);
  }

  async initialize(): Promise<ReplayState> {
    if (this.cursor === 0) {
      await this.emitAt(this.emissionTimes[0] ?? 0);
      this.cursor = 1;
    }
    this.notify();
    return this.getState();
  }

  getState(): ReplayState {
    const currentTimeMs = this.liveCurrentTime();
    return {
      mode: "REPLAY",
      replayId: this.dataset.id,
      runId: this.runId,
      fixtureId: this.fixtureId,
      title: this.dataset.title,
      competition: this.dataset.competition,
      participants: this.dataset.fixture.participants,
      finalScore: this.dataset.fixture.finalScore,
      status: this.status,
      speed: this.speed,
      currentTimeMs,
      durationMs: this.dataset.durationMs,
      virtualNowMs: this.virtualEpochMs + currentTimeMs,
      progress: this.dataset.durationMs === 0 ? 1 : currentTimeMs / this.dataset.durationMs,
    };
  }

  play(): ReplayState {
    if (this.disposed || this.status === "FINISHED") return this.getState();
    this.status = "PLAYING";
    this.baseReplayMs = this.currentTimeMs;
    this.baseWallMs = this.wallNow();
    this.notify();
    this.scheduleNext();
    return this.getState();
  }

  pause(): ReplayState {
    if (this.status === "PLAYING") this.currentTimeMs = this.liveCurrentTime();
    this.status = this.currentTimeMs >= this.dataset.durationMs ? "FINISHED" : "PAUSED";
    this.clearTimer();
    this.notify();
    return this.getState();
  }

  setSpeed(speed: ReplaySpeed): ReplayState {
    if (!REPLAY_SPEEDS.includes(speed)) throw new Error("Unsupported replay speed");
    if (this.status === "PLAYING") {
      this.currentTimeMs = this.liveCurrentTime();
      this.baseReplayMs = this.currentTimeMs;
      this.baseWallMs = this.wallNow();
    }
    this.speed = speed;
    this.clearTimer();
    this.notify();
    if (this.status === "PLAYING") this.scheduleNext();
    return this.getState();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private liveCurrentTime(): number {
    if (this.status !== "PLAYING") return this.currentTimeMs;
    return clamp(
      this.baseReplayMs + (this.wallNow() - this.baseWallMs) * this.speed,
      0,
      this.dataset.durationMs,
    );
  }

  private scheduleNext(): void {
    if (this.disposed || this.status !== "PLAYING" || this.timer) return;
    const target = this.emissionTimes[this.cursor];
    if (target === undefined) {
      this.finish();
      return;
    }
    const delayMs = Math.max(0, (target - this.liveCurrentTime()) / this.speed);
    this.timer = this.scheduleTimer(() => {
      this.timer = null;
      void this.advance(target);
    }, delayMs);
  }

  private async advance(target: number): Promise<void> {
    if (this.disposed || this.status !== "PLAYING") return;
    this.currentTimeMs = target;
    this.baseReplayMs = target;
    this.baseWallMs = this.wallNow();
    try {
      await this.emitAt(target);
      this.cursor += 1;
      if (target >= this.dataset.durationMs) this.finish();
      else {
        this.notify();
        this.scheduleNext();
      }
    } catch {
      this.status = "PAUSED";
      this.notify();
      console.error("[ReplayEngine] replay emission paused after an error");
    }
  }

  private async emitAt(atMs: number): Promise<void> {
    const candidates = this.dataset.timeline.filter((entry) => entry.atMs <= atMs);
    const entry = candidates[candidates.length - 1];
    if (!entry) throw new Error("Replay has no initial score update");
    const update = entry.update;
    const inPlay = update.matchPhase === "FIRST_HALF" || update.matchPhase === "SECOND_HALF";
    const elapsedMinutes = inPlay ? Math.floor((atMs - entry.atMs) / 60_000) : 0;
    const exactKeyFrame = entry.atMs === atMs;
    await this.emitUpdate(
      {
        ...update,
        fixtureId: this.fixtureId,
        seq: this.cursor + 1,
        ts: this.virtualEpochMs + atMs,
        matchMinute: update.matchMinute + elapsedMinutes,
        participants: this.dataset.fixture.participants,
        stats: { ...update.stats },
        availableStats: [...update.availableStats],
        event: exactKeyFrame ? update.event : undefined,
      },
      this.virtualEpochMs + atMs,
    );
  }

  private finish(): void {
    this.currentTimeMs = this.dataset.durationMs;
    this.status = "FINISHED";
    this.clearTimer();
    this.notify();
  }

  private notify(): void {
    this.onState?.(this.getState());
  }

  private clearTimer(): void {
    if (this.timer) this.cancelTimer(this.timer);
    this.timer = null;
  }
}
