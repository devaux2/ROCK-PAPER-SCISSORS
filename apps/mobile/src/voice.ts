import { Platform } from 'react-native';
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, VoiceSignalPayload } from '@rps/shared';
import { useSettingsStore } from './stores/settingsStore';

/**
 * Ad-hoc voice chat between the two players of a match: peer-to-peer WebRTC
 * audio, signaled over the existing game socket ('voice:signal' relay).
 * Live from the moment both land in the match until either leaves the match
 * screen. Web-only — on native this module is a silent no-op.
 */

type VoiceStatus = 'off' | 'connecting' | 'live' | 'failed' | 'unsupported';

interface VoiceState {
  status: VoiceStatus;
  micMuted: boolean;
}

export const useVoiceStore = create<VoiceState>(() => ({
  status: 'off',
  micMuted: false,
}));

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketRef: GameSocket | null = null;
let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let audioEl: HTMLAudioElement | null = null;
let currentMatchId: string | null = null;
let amInitiator = false;
let remoteDescribed = false;
let pendingCandidates: unknown[] = [];
/**
 * Bumped on every startVoice/stopVoice. A startVoice that awaits
 * getUserMedia checks its own token afterwards, so two concurrent calls
 * for the SAME match (unmount+remount while the mic prompt is up) can't
 * both install a stream — the stale one tears its own media down.
 */
let generation = 0;
/** Signals that arrived before startVoice() ran for their match. */
const earlySignals = new Map<string, unknown[]>();

function supported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof RTCPeerConnection !== 'undefined'
  );
}

function setStatus(status: VoiceStatus) {
  useVoiceStore.setState({ status });
  // Debug hook for automated checks.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__rpsVoice = status;
  }
}

/** Wire the shared game socket in (called by connectSocket). */
export function bindVoiceSocket(socket: GameSocket): void {
  socketRef = socket;
  socket.on('voice:signal', (p: VoiceSignalPayload) => {
    if (p.matchId === currentMatchId && pc) {
      void handleSignal(p.data);
    } else {
      // Opponent's client can beat ours to the match screen — buffer.
      const queue = earlySignals.get(p.matchId) ?? [];
      if (queue.length < 64) queue.push(p.data);
      earlySignals.set(p.matchId, queue);
      if (earlySignals.size > 4) {
        const oldest = earlySignals.keys().next().value;
        if (oldest && oldest !== p.matchId) earlySignals.delete(oldest);
      }
    }
  });
}

export function unbindVoiceSocket(): void {
  stopVoice();
  socketRef = null;
  earlySignals.clear();
}

function send(data: unknown): void {
  if (socketRef && currentMatchId) {
    socketRef.emit('voice:signal', { matchId: currentMatchId, data });
  }
}

async function handleSignal(data: unknown): Promise<void> {
  if (!pc) return;
  const msg = data as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null };
  try {
    if (msg.sdp) {
      await pc.setRemoteDescription(msg.sdp);
      remoteDescribed = true;
      for (const c of pendingCandidates) {
        await pc.addIceCandidate(c as RTCIceCandidateInit).catch(() => {});
      }
      pendingCandidates = [];
      if (msg.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ sdp: pc.localDescription?.toJSON?.() ?? pc.localDescription });
      }
    } else if (msg.candidate !== undefined) {
      if (!remoteDescribed) pendingCandidates.push(msg.candidate);
      else if (msg.candidate) await pc.addIceCandidate(msg.candidate).catch(() => {});
    }
  } catch {
    // Glare/expired signals — a fresh match will renegotiate from scratch.
  }
}

/**
 * Open the line for a match. p1 makes the offer, p2 answers. Safe to call
 * repeatedly; a new matchId tears down the previous call first.
 */
export async function startVoice(matchId: string, initiator: boolean): Promise<void> {
  if (!supported()) {
    setStatus('unsupported');
    return;
  }
  if (!useSettingsStore.getState().voiceEnabled) {
    setStatus('off');
    return;
  }
  if (currentMatchId === matchId && pc) return;
  stopVoice();
  const myGen = ++generation;
  currentMatchId = matchId;
  amInitiator = initiator;
  setStatus('connecting');

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    if (myGen === generation) setStatus('failed'); // mic denied — play on without voice
    return;
  }
  // A newer startVoice/stopVoice superseded us while the permission prompt
  // was up — drop this stream so we never orphan the mic.
  if (myGen !== generation) {
    stream.getTracks().forEach((t) => t.stop());
    return;
  }

  localStream = stream;
  useVoiceStore.setState({ micMuted: false });
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  pc = peer;
  remoteDescribed = false;
  pendingCandidates = [];

  stream.getTracks().forEach((t) => peer.addTrack(t, stream));

  peer.onicecandidate = (e) => {
    send({ candidate: e.candidate ? e.candidate.toJSON() : null });
  };
  peer.ontrack = (e) => {
    if (typeof document === 'undefined') return;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (audioEl as any).playsInline = true;
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    audioEl.volume = useSettingsStore.getState().voiceVolume;
    void audioEl.play().catch(() => {});
  };
  peer.onconnectionstatechange = () => {
    if (pc !== peer) return;
    if (peer.connectionState === 'connected') setStatus('live');
    else if (peer.connectionState === 'failed') setStatus('failed');
    else if (peer.connectionState === 'disconnected') setStatus('connecting');
  };

  // Drain anything the opponent sent before we were ready.
  const early = earlySignals.get(matchId);
  earlySignals.delete(matchId);
  if (early) for (const data of early) await handleSignal(data);

  if (amInitiator) {
    try {
      const offer = await peer.createOffer();
      if (pc !== peer) return;
      await peer.setLocalDescription(offer);
      send({ sdp: peer.localDescription?.toJSON?.() ?? peer.localDescription });
    } catch {
      setStatus('failed');
    }
  }
}

export function stopVoice(): void {
  // Invalidate any startVoice still awaiting getUserMedia so it won't
  // install a stream after we've torn down.
  generation += 1;
  currentMatchId = null;
  pendingCandidates = [];
  remoteDescribed = false;
  if (pc) {
    try {
      pc.close();
    } catch {
      // already closed
    }
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (audioEl) {
    audioEl.srcObject = null;
    audioEl.remove();
    audioEl = null;
  }
  setStatus('off');
}

/** Toggle the local mic; returns the new muted state. */
export function toggleMic(): boolean {
  const muted = !useVoiceStore.getState().micMuted;
  useVoiceStore.setState({ micMuted: muted });
  localStream?.getAudioTracks().forEach((t) => {
    t.enabled = !muted;
  });
  return muted;
}

/** Live-apply the settings volume to the remote audio element. */
export function applyVoiceVolume(volume: number): void {
  if (audioEl) audioEl.volume = volume;
}
