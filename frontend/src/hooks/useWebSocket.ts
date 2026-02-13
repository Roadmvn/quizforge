import { useEffect, useRef, useCallback, useState } from 'react';
import type { WsMessage } from '../lib/types';

interface UseWebSocketOpts {
  sessionId: string;
  role: 'admin' | 'participant';
  token?: string;
  pid?: string;
  onMessage: (msg: WsMessage) => void;
}

export function useWebSocket({ sessionId, role, token, pid, onMessage }: UseWebSocketOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let url = `${protocol}//${host}/ws/session/${sessionId}?role=${role}`;
    if (token) url += `&token=${token}`;
    if (pid) url += `&pid=${pid}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current(data);
      } catch { /* ignore */ }
    };

    return () => { ws.close(); };
  }, [sessionId, role, token, pid]);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}
