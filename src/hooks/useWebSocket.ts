import { useState, useCallback, useRef, useEffect } from "react";

export type WebSocketStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WebSocketMessage {
  id: string;
  type: "sent" | "received";
  data: string;
  timestamp: Date;
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  messages: WebSocketMessage[];
  connect: (url: string) => void;
  disconnect: () => void;
  send: (message: string) => boolean;
  clearMessages: () => void;
  error: string | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
    setError(null);
  }, []);

  const connect = useCallback((url: string) => {
    // Disconnect any existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("connecting");
    setError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setError(null);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "received",
            data: `[Connected to ${url}]`,
            timestamp: new Date(),
          },
        ]);
      };

      ws.onmessage = (event) => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "received",
            data: typeof event.data === "string" ? event.data : JSON.stringify(event.data),
            timestamp: new Date(),
          },
        ]);
      };

      ws.onerror = () => {
        setStatus("error");
        setError("WebSocket connection error");
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        wsRef.current = null;
        
        if (!event.wasClean) {
          setError(`Connection closed unexpectedly (code: ${event.code})`);
        }
        
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "received",
            data: `[Disconnected${event.reason ? `: ${event.reason}` : ""}]`,
            timestamp: new Date(),
          },
        ]);
      };
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, []);

  const send = useCallback((message: string): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      wsRef.current.send(message);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "sent",
          data: message,
          timestamp: new Date(),
        },
      ]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      return false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    status,
    messages,
    connect,
    disconnect,
    send,
    clearMessages,
    error,
  };
}
