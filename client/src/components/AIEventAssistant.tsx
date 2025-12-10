import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, User, Bot, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface AIEventAssistantProps {
  itineraryId: string;
  groupId: string | null;
  onVenueAdded?: () => void;
}

const SESSION_KEY_PREFIX = "kinmo-ai-session-";

export function AIEventAssistant({
  itineraryId,
  groupId,
  onVenueAdded,
}: AIEventAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    // Try to restore session from localStorage
    if (typeof window !== "undefined") {
      return localStorage.getItem(`${SESSION_KEY_PREFIX}${itineraryId}`);
    }
    return null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Save session ID to localStorage
  useEffect(() => {
    if (sessionId && typeof window !== "undefined") {
      localStorage.setItem(`${SESSION_KEY_PREFIX}${itineraryId}`, sessionId);
    }
  }, [sessionId, itineraryId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Use longer timeout for AI chat - Claude with tool calls can take a while
      const data = await apiRequest(
        "POST",
        `/api/itineraries/${itineraryId}/ai-chat`,
        {
          prompt: userMessage.content,
          sessionId: sessionId,
          stream: false, // Use non-streaming for simplicity
        },
        { timeout: 90000 } // 90 seconds for AI responses
      );

      if (data.error) {
        throw new Error(data.error);
      }

      // Update session ID
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response || "I couldn't generate a response. Please try again.",
          timestamp: new Date(),
          toolsUsed: data.toolsUsed,
        },
      ]);

      // Invalidate queries to refresh itinerary data
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/itineraries/${itineraryId}`],
      });
      onVenueAdded?.();
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `Sorry, I encountered an error: ${error.message || "Unknown error"}. Please try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, itineraryId, sessionId, queryClient, onVenueAdded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setSessionId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`${SESSION_KEY_PREFIX}${itineraryId}`);
    }
    inputRef.current?.focus();
  };

  // Example prompts for empty state
  const examplePrompts = [
    "Find craft beer bars near the Marina",
    "Suggest a bar crawl route from Double Standard",
    "What's in our itinerary so far?",
    "Add a dessert spot after dinner",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[hsl(32,20%,88%)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(44,87%,63%)]" />
            <h3 className="font-semibold text-[hsl(25,30%,14%)]">
              AI Event Assistant
            </h3>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetConversation}
              className="text-xs text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)]"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
        <p className="text-sm text-[hsl(25,15%,45%)] mt-1">
          Ask me to find venues, suggest alternatives, or help plan your event
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="h-10 w-10 text-[hsl(44,87%,63%)] mx-auto mb-3" />
            <p className="text-sm text-[hsl(25,15%,45%)] mb-4">
              Try asking something like:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {examplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setInput(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[hsl(38,50%,97%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(38,50%,93%)] transition-colors border border-[hsl(32,20%,88%)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(44,87%,63%)] flex items-center justify-center">
                  <Bot className="h-4 w-4 text-[hsl(25,30%,14%)]" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5",
                  message.role === "user"
                    ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]"
                    : "bg-[hsl(38,50%,97%)] text-[hsl(25,30%,14%)] border border-[hsl(32,20%,88%)]"
                )}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
                {message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[hsl(32,20%,88%)]">
                    <p className="text-xs text-[hsl(25,15%,55%)]">
                      Used: {message.toolsUsed.join(", ")}
                    </p>
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(220,15%,90%)] flex items-center justify-center">
                  <User className="h-4 w-4 text-[hsl(25,30%,14%)]" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(44,87%,63%)] flex items-center justify-center">
              <Bot className="h-4 w-4 text-[hsl(25,30%,14%)]" />
            </div>
            <div className="flex items-center gap-2 text-sm text-[hsl(25,15%,45%)] py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[hsl(32,20%,88%)] p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for venue suggestions..."
            disabled={isLoading}
            className="flex-1"
            maxLength={2000}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={cn(
              "gap-2 bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
              "hover:bg-[hsl(44,87%,58%)]"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-[hsl(25,15%,55%)] mt-2 text-center">
          Press Enter to send
        </p>
      </div>
    </div>
  );
}
