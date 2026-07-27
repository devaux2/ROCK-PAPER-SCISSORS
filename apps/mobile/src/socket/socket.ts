import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Move,
  WagerTier,
  EmoteId,
  MatchStatePayload,
} from '@rps/shared';
import { useMatchStore } from '../stores/matchStore';
import { useFriendsStore } from '../stores/friendsStore';
import { useAuthStore } from '../stores/authStore';
import { bindVoiceSocket, unbindVoiceSocket } from '../voice';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/** Connect (or reconnect) the realtime socket and wire events into the stores. */
export function connectSocket(baseUrl: string, token: string): GameSocket {
  disconnectSocket();
  socket = io(baseUrl, {
    auth: { token },
    transports: ['websocket'],
  });

  const match = useMatchStore.getState;
  const friends = useFriendsStore.getState;

  socket.on('match:start', (p) => match().onMatchStart(p));
  socket.on('round:start', (p) => match().onRoundStart(p));
  socket.on('round:result', (p) => match().onRoundResult(p));
  socket.on('match:end', (p) => {
    match().onMatchEnd(p);
    // Coins changed — refresh the cached profile.
    void useAuthStore.getState().refreshMe();
  });
  socket.on('match:state', (p) => match().onResync(p));
  socket.on('match:emote', (p) => match().onEmote(p.emoteId));
  socket.on('rematch:offered', () => match().onRematchOffered());
  socket.on('challenge:incoming', (p) => friends().setIncomingChallenge(p));
  socket.on('friend:presence', (p) => friends().setPresence(p.userId, p.online));
  socket.on('connect', () => {
    // Ask for a snapshot in case we dropped mid-match.
    socket?.emit('match:resync', (state: MatchStatePayload | null) => {
      if (state) match().onResync(state);
    });
  });
  bindVoiceSocket(socket);

  return socket;
}

export function disconnectSocket(): void {
  unbindVoiceSocket();
  socket?.disconnect();
  socket = null;
}

export function getSocket(): GameSocket | null {
  return socket;
}

function ack(fn: (cb: (r: { ok: boolean; error?: string }) => void) => void): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'Not connected' });
      return;
    }
    fn(resolve);
  });
}

export const game = {
  joinQueue: (mode: 'ranked' | 'casual', wagerTier?: WagerTier) =>
    ack((cb) => socket!.emit('queue:join', { mode, wagerTier }, cb)),
  leaveQueue: () => socket?.emit('queue:leave'),
  startBotMatch: () => ack((cb) => socket!.emit('bot:start', cb)),
  submitMove: (matchId: string, move: Move) =>
    ack((cb) => socket!.emit('match:move', { matchId, move }, cb)),
  sendEmote: (matchId: string, emoteId: EmoteId) => socket?.emit('match:emote', { matchId, emoteId }),
  requestRematch: (matchId: string) => ack((cb) => socket!.emit('match:rematch', { matchId }, cb)),
  forfeit: (matchId: string) => socket?.emit('match:forfeit', { matchId }),
  sendChallenge: (toUserId: number, wagerTier?: WagerTier) =>
    new Promise<{ ok: boolean; challengeId?: string; error?: string }>((resolve) => {
      if (!socket) {
        resolve({ ok: false, error: 'Not connected' });
        return;
      }
      socket.emit('challenge:send', { toUserId, wagerTier }, resolve);
    }),
  acceptChallenge: (challengeId: string) =>
    ack((cb) => socket!.emit('challenge:accept', { challengeId }, cb)),
  declineChallenge: (challengeId: string) => socket?.emit('challenge:decline', { challengeId }),
};
