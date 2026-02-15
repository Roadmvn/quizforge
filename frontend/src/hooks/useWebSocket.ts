import { useEffect, useRef, useCallback, useState } from 'react';
import type { WsMessage } from '../lib/types';

interface UseWebSocketOpts {
  sessionId: string;
  role: 'admin' | 'participant';
  token?: string;
  pid?: string;
  ptoken?: string;
  onMessage: (msg: WsMessage) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY = 1000;

export function useWebSocket({ sessionId, role, token, pid, ptoken, onMessage }: UseWebSocketOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unmountedRef = useRef(false);
  const authenticatedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    // Don't connect if participant credentials are missing
    if (role === 'participant' && (!pid || !ptoken)) return;
    if (role === 'admin' && !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/session/${sessionId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    authenticatedRef.current = false;

    ws.onopen = () => {
      const authMsg: Record<string, string> = { type: 'auth', role };
      if (role === 'admin' && token) {
        authMsg.token = token;
      } else if (role === 'participant') {
        if (pid) authMsg.pid = pid;
        if (ptoken) authMsg.ptoken = ptoken;
      }
      ws.send(JSON.stringify(authMsg));
    };

    ws.onclose = (e) => {
      setConnected(false);
      authenticatedRef.current = false;
      if (unmountedRef.current || e.code >= 4000) return;
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_DELAY * Math.pow(2, reconnectAttempts.current);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!authenticatedRef.current) {
          if (data.type === 'auth_ok') {
            authenticatedRef.current = true;
            setConnected(true);
            reconnectAttempts.current = 0;
          }
          return;
        }
        onMessageRef.current(data);
      } catch { /* ignore malformed */ }
    };
  }, [sessionId, role, token, pid, ptoken]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && authenticatedRef.current) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}
