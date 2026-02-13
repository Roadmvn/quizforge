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
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const unmountedRef = useRef(false);

  const buildUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let url = `${protocol}//${host}/ws/session/${sessionId}?role=${role}`;
    if (token) url += `&token=${token}`;
    if (pid) url += `&pid=${pid}`;
    if (ptoken) url += `&ptoken=${ptoken}`;
    return url;
  }, [sessionId, role, token, pid, ptoken]);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(buildUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onclose = (e) => {
      setConnected(false);
      // Don't reconnect on auth errors (4001, 4003, 4004) or intentional close
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
        onMessageRef.current(data);
      } catch { /* ignore malformed */ }
    };
  }, [buildUrl]);

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}
