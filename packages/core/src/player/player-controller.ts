import type { InnertubeClient } from '../innertube/client.js';
import { parsePlayerResponse, selectBestAudioFormat } from '../innertube/parsers/stream.js';
import { QueueMachine } from '../queue/queue-machine.js';
import { RadioManager } from '../queue/radio.js';
import type { CacheManager } from '../storage/cache-manager.js';
import type { DatabaseFacade } from '../storage/db-facade.js';
import { TypedEventEmitter, type Unsubscribe } from '../types/events.js';
import type { CoreEventMap } from '../types/events.js';
import type {
  AudioQuality,
  PlaybackError,
  PlaybackMode,
  PlaybackState,
  RepeatMode,
} from '../types/player.js';
import type { AudioSinkError, AudioSinkState, AudioSinkTime, IAudioSinkAdapter } from '../types/ports.js';
import type { Track } from '../types/track.js';

export interface PlayerControllerDependencies {
  readonly audioSink: IAudioSinkAdapter;
  readonly innertube: InnertubeClient;
  readonly storage: DatabaseFacade;
  readonly cacheManager?: CacheManager;
  readonly events?: TypedEventEmitter<CoreEventMap>;
  readonly cipherOps?: readonly (readonly [action: 'reverse' | 'splice' | 'swap', param: number])[];
}

/**
 * Master Headless Audio Player Controller.
 *
 * Coordinates AudioSink drivers, Innertube API streaming, Queue state machines,
 * offline caching, and database persistence into a unified reactive engine.
 */
export class PlayerController {
  public readonly events: TypedEventEmitter<CoreEventMap>;
  public readonly queue: QueueMachine;

  private readonly audioSink: IAudioSinkAdapter;
  private readonly innertube: InnertubeClient;
  private readonly storage: DatabaseFacade;
  private readonly cacheManager?: CacheManager;
  private readonly radio: RadioManager;
  private readonly cipherOps?: readonly (readonly [action: 'reverse' | 'splice' | 'swap', param: number])[];

  private state: PlaybackState = {
    status: 'idle',
    positionSec: 0,
    durationSec: 0,
    bufferedSec: 0,
  };

  private mode: PlaybackMode = {
    repeat: 'off',
    shuffle: false,
    autoplayRadio: true,
  };

  private currentTrack: Track | null = null;
  private activeLoadId: number = 0;
  private hasTrackRecordedInHistory: boolean = false;
  private readonly sinkUnsubscribers: Unsubscribe[] = [];

  public constructor(deps: PlayerControllerDependencies) {
    this.audioSink = deps.audioSink;
    this.innertube = deps.innertube;
    this.storage = deps.storage;
    this.cacheManager = deps.cacheManager;
    this.cipherOps = deps.cipherOps;
    this.events = deps.events ?? new TypedEventEmitter<CoreEventMap>();

    this.queue = new QueueMachine({
      repeatMode: this.mode.repeat,
    });

    this.radio = new RadioManager({
      client: this.innertube,
    });

    this.bindSinkListeners();
    this.initFromPreferences().catch(() => {});
  }

  /**
   * Loads saved preferences (volume, audio quality, radio autoplay).
   */
  private async initFromPreferences(): Promise<void> {
    try {
      const prefs = await this.storage.getPreferences();
      this.mode = {
        repeat: this.mode.repeat,
        shuffle: this.queue.shuffled,
        autoplayRadio: prefs.autoplayRadio,
      };
      await this.audioSink.setVolume(prefs.muted ? 0 : prefs.volume);
    } catch {
      // Use defaults if storage read fails
    }
  }

  /**
   * Attaches listeners to the platform AudioSink.
   */
  private bindSinkListeners(): void {
    this.sinkUnsubscribers.push(
      this.audioSink.onStateChange((sinkState) => {
        this.handleSinkStateChange(sinkState);
      }),
      this.audioSink.onTimeUpdate((time) => {
        this.handleSinkTimeUpdate(time);
      }),
      this.audioSink.onError((err) => {
        this.handleSinkError(err);
      }),
      this.audioSink.onEnded(() => {
        this.handleTrackEnded();
      }),
    );
  }

  // ==========================================
  // PLAYBACK ACTIONS
  // ==========================================

  /**
   * Plays a single track directly.
   * Immediately streams and kicks off YouTube Music RDAMVM radio expansion for Next Up.
   */
  public async playTrack(track: Track): Promise<void> {
    this.radio.reset();
    this.currentTrack = track;
    this.queue.setQueue([track], 0);
    this.emitQueueUpdate();

    // Immediately query YouTube Music radio so Next Up queue is populated without delay
    if (this.mode.autoplayRadio) {
      this.expandQueueFromRadio(track).catch(() => {});
    }

    await this.loadAndPlay(track);
  }

  /**
   * Loads a playlist and initiates playback from startIndex.
   */
  public async playPlaylist(tracks: readonly Track[], startIndex: number = 0): Promise<void> {
    if (tracks.length === 0) return;
    this.radio.reset();
    this.queue.setQueue(tracks, startIndex);
    this.emitQueueUpdate();

    const targetTrack = this.queue.currentTrack;
    if (targetTrack) {
      if (this.queue.remainingCount <= 2 && this.mode.autoplayRadio) {
        this.expandQueueFromRadio(targetTrack).catch(() => {});
      }
      await this.loadAndPlay(targetTrack);
    }
  }

  /**
   * Resumes playback if paused, or plays current queue head.
   */
  public async play(): Promise<void> {
    if (this.state.status === 'paused') {
      await this.audioSink.play();
      return;
    }

    if (this.state.status === 'idle') {
      const track = this.queue.currentTrack;
      if (track) {
        await this.loadAndPlay(track);
      }
    }
  }

  /**
   * Pauses active playback.
   */
  public async pause(): Promise<void> {
    await this.audioSink.pause();
  }

  /**
   * Toggles between play and pause.
   */
  public async togglePlayPause(): Promise<void> {
    if (this.state.status === 'playing') {
      await this.pause();
    } else {
      await this.play();
    }
  }

  /**
   * Advances to next track in queue.
   * If remaining tracks <= 2 and autoplayRadio is enabled, fetches radio recommendations.
   */
  public async next(): Promise<void> {
    const nextTrack = this.queue.next();

    if (nextTrack) {
      this.emitQueueUpdate();
      await this.loadAndPlay(nextTrack);
      this.checkAndPreloadRadio().catch(() => {});
    } else if (this.mode.autoplayRadio && this.currentTrack) {
      // Queue exhausted: query radio
      await this.expandQueueFromRadio(this.currentTrack);
      const radioTrack = this.queue.next();
      if (radioTrack) {
        this.emitQueueUpdate();
        await this.loadAndPlay(radioTrack);
      } else {
        await this.stop();
      }
    } else {
      await this.stop();
    }
  }

  /**
   * Retreats to previous track or seeks to 0 if played past threshold.
   */
  public async previous(): Promise<void> {
    const prevTrack = this.queue.previous(this.state.positionSec, 3);
    if (!prevTrack) return;

    if (prevTrack.id === this.currentTrack?.id) {
      // Seek back to start
      await this.seek(0);
      await this.play();
    } else {
      this.emitQueueUpdate();
      await this.loadAndPlay(prevTrack);
    }
  }

  /**
   * Jumps to a specific position in the queue.
   */
  public async jumpTo(index: number): Promise<void> {
    const track = this.queue.jumpTo(index);
    if (track) {
      this.emitQueueUpdate();
      await this.loadAndPlay(track);
      this.checkAndPreloadRadio().catch(() => {});
    }
  }

  /**
   * Seeks audio to specific seconds.
   */
  public async seek(positionSec: number): Promise<void> {
    await this.audioSink.seek(positionSec);
  }

  /**
   * Sets volume between 0.0 and 1.0.
   */
  public async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, volume));
    await this.audioSink.setVolume(clamped);
    await this.storage.updatePreferences({ volume: clamped, muted: clamped === 0 });
    this.events.emit('playback:volumeChange', { volume: clamped, muted: clamped === 0 });
  }

  /**
   * Sets mute state.
   */
  public async setMuted(muted: boolean): Promise<void> {
    await this.audioSink.setMuted(muted);
    await this.storage.updatePreferences({ muted });
    const prefs = await this.storage.getPreferences();
    this.events.emit('playback:volumeChange', { volume: prefs.volume, muted });
  }

  /**
   * Sets repeat mode ('off' | 'all' | 'one').
   */
  public setRepeatMode(mode: RepeatMode): void {
    this.queue.setRepeatMode(mode);
    this.mode = { ...this.mode, repeat: mode };
    this.events.emit('playback:modeChange', this.mode);
  }

  /**
   * Toggles shuffle.
   */
  public toggleShuffle(): boolean {
    const isShuffled = this.queue.toggleShuffle();
    this.mode = { ...this.mode, shuffle: isShuffled };
    this.events.emit('playback:modeChange', this.mode);
    this.emitQueueUpdate();
    return isShuffled;
  }

  /**
   * Stops playback and returns to idle state.
   */
  public async stop(): Promise<void> {
    await this.audioSink.stop();
    this.currentTrack = null;
    this.updateState({
      status: 'idle',
      positionSec: 0,
      durationSec: 0,
      bufferedSec: 0,
    });
    this.events.emit('playback:trackChange', null);
  }

  // ==========================================
  // STREAM RESOLUTION & PLAYBACK CORE
  // ==========================================

  private async loadAndPlay(track: Track): Promise<void> {
    const loadId = ++this.activeLoadId;
    this.currentTrack = track;
    this.hasTrackRecordedInHistory = false;

    this.updateState({
      status: 'loading',
      track,
      positionSec: 0,
      durationSec: track.durationSec,
      bufferedSec: 0,
    });
    this.events.emit('playback:trackChange', track);

    // Immediately pause previous playback so it stops with 0ms delay while loading new track
    try {
      await this.audioSink.pause();
    } catch {
      // Silently ignore if sink was already paused or idle
    }

    try {
      // 1. Check local-first offline cache
      let streamUrl: string | null = null;
      if (this.cacheManager) {
        streamUrl = await this.cacheManager.getStreamUri(track.id);
      }

      // 2. Fetch remote stream from Innertube if not cached
      if (!streamUrl) {
        streamUrl = await this.resolveRemoteStreamUrl(track.id);
      }

      // Prevent race conditions if user skipped quickly
      if (this.activeLoadId !== loadId) return;

      // 3. Hand off stream to platform audio sink
      const artwork = track.thumbnails[track.thumbnails.length - 1]?.url;
      await this.audioSink.load({
        url: streamUrl,
        title: track.title,
        artist: track.artists.map((a) => a.name).join(', '),
        album: track.album?.name,
        artworkUrl: artwork,
        durationSec: track.durationSec,
      });

      await this.audioSink.play();
    } catch (err) {
      if (this.activeLoadId !== loadId) return;

      const playbackError: PlaybackError = isPlaybackError(err)
        ? err
        : {
            code: 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : String(err),
            fatal: true,
            underlyingError: err,
          };

      this.updateState({
        status: 'error',
        track,
        positionSec: 0,
        durationSec: track.durationSec,
        bufferedSec: 0,
        error: playbackError,
      });
      this.events.emit('playback:error', playbackError);
    }
  }

  /**
   * Fetches stream formats via Innertube client and selects optimal format.
   */
  private async resolveRemoteStreamUrl(videoId: string): Promise<string> {
    const prefs = await this.storage.getPreferences();
    const playerResponse = await this.innertube.player(videoId);
    const manifest = parsePlayerResponse(videoId, playerResponse.data, this.cipherOps);

    const bestFormat = selectBestAudioFormat(
      manifest.formats,
      prefs.audioQuality as AudioQuality,
      prefs.preferredCodec,
    );

    return bestFormat.url;
  }

  // ==========================================
  // EVENT HANDLERS & INTERNAL STATE
  // ==========================================

  private handleSinkStateChange(sinkState: AudioSinkState): void {
    if (!this.currentTrack) return;

    switch (sinkState) {
      case 'playing':
        this.updateState({
          status: 'playing',
          track: this.currentTrack,
          positionSec: this.state.positionSec,
          durationSec: this.state.durationSec || this.currentTrack.durationSec,
          bufferedSec: this.state.bufferedSec,
        });
        break;
      case 'paused':
        this.updateState({
          status: 'paused',
          track: this.currentTrack,
          positionSec: this.state.positionSec,
          durationSec: this.state.durationSec,
          bufferedSec: this.state.bufferedSec,
        });
        break;
      case 'buffering':
        this.updateState({
          status: 'buffering',
          track: this.currentTrack,
          positionSec: this.state.positionSec,
          durationSec: this.state.durationSec,
          bufferedSec: this.state.bufferedSec,
        });
        break;
      case 'ended':
        this.handleTrackEnded();
        break;
    }
  }

  private handleSinkTimeUpdate(time: AudioSinkTime): void {
    if (!this.currentTrack) return;

    const duration = time.durationSec > 0 ? time.durationSec : this.currentTrack.durationSec;
    const currentStatus = this.state.status;

    if (
      currentStatus === 'playing' ||
      currentStatus === 'buffering' ||
      currentStatus === 'paused'
    ) {
      this.updateState({
        status: currentStatus,
        track: this.currentTrack,
        positionSec: time.positionSec,
        durationSec: duration,
        bufferedSec: time.bufferedSec,
      });
    }

    this.events.emit('playback:time', {
      positionSec: time.positionSec,
      durationSec: duration,
      bufferedSec: time.bufferedSec,
    });

    // Record history once track plays past 30s or > 50%
    if (
      !this.hasTrackRecordedInHistory &&
      (time.positionSec >= 30 || (duration > 0 && time.positionSec / duration >= 0.5))
    ) {
      this.hasTrackRecordedInHistory = true;
      this.storage.recordHistory(this.currentTrack, false).catch(() => {});
    }
  }

  private handleSinkError(sinkError: AudioSinkError): void {
    this.updateState({
      status: 'error',
      track: this.currentTrack ?? undefined,
      positionSec: this.state.positionSec,
      durationSec: this.state.durationSec,
      bufferedSec: this.state.bufferedSec,
      error: sinkError,
    });
    this.events.emit('playback:error', sinkError);
  }

  private handleTrackEnded(): void {
    if (this.currentTrack) {
      this.storage.recordHistory(this.currentTrack, true).catch(() => {});
    }
    // Auto advance to next track
    this.next().catch(() => {});
  }

  private updateState(newState: PlaybackState): void {
    this.state = newState;
    this.events.emit('playback:state', newState);
  }

  private emitQueueUpdate(): void {
    this.events.emit('queue:updated', {
      queue: this.queue.tracks,
      currentIndex: this.queue.index,
      history: this.queue.historyTracks,
    });
  }

  private async checkAndPreloadRadio(): Promise<void> {
    if (!this.mode.autoplayRadio || !this.currentTrack) return;

    if (this.queue.remainingCount <= 2) {
      await this.expandQueueFromRadio(this.currentTrack);
    }
  }

  private async expandQueueFromRadio(seedTrack: Track): Promise<void> {
    const queueIds = new Set(this.queue.tracks.map((t) => t.id));
    const radioTracks = await this.radio.fetchNextRadioBatch(seedTrack, queueIds);

    // If active track changed while waiting for radio batch, discard obsolete recommendations
    if (this.currentTrack?.id !== seedTrack.id) {
      return;
    }

    if (radioTracks.length > 0) {
      this.queue.addTracks(radioTracks, 'end');
      this.emitQueueUpdate();
    }
  }

  // --- Getters ---

  public get playbackState(): PlaybackState {
    return this.state;
  }

  public get playbackMode(): PlaybackMode {
    return this.mode;
  }

  public get activeTrack(): Track | null {
    return this.currentTrack;
  }

  /**
   * Releases listeners and audio driver resources.
   */
  public async dispose(): Promise<void> {
    for (const unsub of this.sinkUnsubscribers) {
      unsub();
    }
    this.sinkUnsubscribers.length = 0;
    this.events.removeAllListeners();
    await this.audioSink.dispose();
  }
}

function isPlaybackError(err: unknown): err is PlaybackError {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as Record<string, unknown>;
  return typeof candidate['code'] === 'string' && typeof candidate['message'] === 'string';
}
