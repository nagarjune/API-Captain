import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plug, 
  Unplug, 
  Send, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocket, WebSocketMessage, WebSocketStatus } from "@/hooks/useWebSocket";
import { format } from "date-fns";

interface WebSocketPanelProps {
  initialUrl?: string;
}

const statusColors: Record<WebSocketStatus, string> = {
  disconnected: "bg-muted text-muted-foreground",
  connecting: "bg-warning/20 text-warning",
  connected: "bg-success/20 text-success",
  error: "bg-destructive/20 text-destructive",
};

const statusLabels: Record<WebSocketStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  connected: "Connected",
  error: "Error",
};

export function WebSocketPanel({ initialUrl = "" }: WebSocketPanelProps) {
  const [wsUrl, setWsUrl] = useState(initialUrl);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    status,
    messages,
    connect,
    disconnect,
    send,
    clearMessages,
    error,
  } = useWebSocket();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnect = () => {
    if (!wsUrl.trim()) return;
    
    // Validate URL format
    if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
      return;
    }
    
    connect(wsUrl);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleSend = () => {
    if (!messageInput.trim() || status !== "connected") return;
    
    const success = send(messageInput);
    if (success) {
      setMessageInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (date: Date) => {
    return format(date, "HH:mm:ss.SSS");
  };

  const formatMessageData = (data: string): string => {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return data;
    }
  };

  const isSystemMessage = (data: string) => {
    return data.startsWith("[") && data.endsWith("]");
  };

  return (
    <div className="space-y-4">
      {/* Connection URL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">WebSocket Connection</h3>
          <Badge className={cn("text-xs", statusColors[status])}>
            {status === "connecting" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {status === "connected" && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {status === "error" && <AlertCircle className="h-3 w-3 mr-1" />}
            {statusLabels[status]}
          </Badge>
        </div>
        
        <div className="flex gap-2">
          <Input
            placeholder="wss://echo.websocket.org"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            className="flex-1 font-mono text-sm"
            disabled={status === "connected" || status === "connecting"}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
          {status === "connected" ? (
            <Button variant="destructive" onClick={handleDisconnect} className="gap-2">
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          ) : (
            <Button 
              variant="hero" 
              onClick={handleConnect} 
              disabled={!wsUrl.trim() || status === "connecting" || (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://"))}
              className="gap-2"
            >
              {status === "connecting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              Connect
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}

        {!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://") && wsUrl.trim() && (
          <p className="text-xs text-muted-foreground">
            URL must start with ws:// or wss://
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Messages</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {messages.length}
            </Badge>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearMessages} className="h-7 px-2">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px] border border-border rounded-md bg-background/50">
          <div className="p-2 space-y-1 font-mono text-xs">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                No messages yet. Connect to a WebSocket server to start.
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} formatTimestamp={formatTimestamp} formatData={formatMessageData} isSystem={isSystemMessage} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Send Message */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Send Message</h3>
        <div className="flex gap-2">
          <Textarea
            placeholder={status === "connected" ? "Enter message to send..." : "Connect to send messages"}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 font-mono text-sm min-h-[80px] resize-none"
            disabled={status !== "connected"}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </p>
          <Button 
            onClick={handleSend} 
            disabled={status !== "connected" || !messageInput.trim()}
            className="gap-2"
            variant="hero"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: WebSocketMessage;
  formatTimestamp: (date: Date) => string;
  formatData: (data: string) => string;
  isSystem: (data: string) => boolean;
}

function MessageItem({ message, formatTimestamp, formatData, isSystem }: MessageItemProps) {
  const isSystemMsg = isSystem(message.data);
  
  return (
    <div
      className={cn(
        "p-2 rounded",
        isSystemMsg
          ? "bg-muted/50 text-muted-foreground italic"
          : message.type === "sent"
          ? "bg-primary/10 border-l-2 border-primary"
          : "bg-success/10 border-l-2 border-success"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {!isSystemMsg && (
          message.type === "sent" ? (
            <ArrowUp className="h-3 w-3 text-primary" />
          ) : (
            <ArrowDown className="h-3 w-3 text-success" />
          )
        )}
        <span className="text-muted-foreground">
          {formatTimestamp(message.timestamp)}
        </span>
        {!isSystemMsg && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {message.type === "sent" ? "SENT" : "RECEIVED"}
          </Badge>
        )}
      </div>
      <pre className="whitespace-pre-wrap break-all text-foreground">
        {formatData(message.data)}
      </pre>
    </div>
  );
}
