import type { TextMessageRecord } from "@workspace/api-client-react";
import { Copy, Download, FileCode2, Trash2, Check, Zap, Clock, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getTextMessageFilename } from "@/lib/text-message";
import { useP2PConnection } from "@/components/p2p-connection-context";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TextMessageCardProps {
  message: TextMessageRecord;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
}

export function TextMessageCard({ message, onDelete, showDelete = true }: TextMessageCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { p2pState, sendClipboardText } = useP2PConnection();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ variant: "destructive", title: "Failed to copy snippet" });
    }
  };

  const handleBeam = () => {
    if (p2pState === "connected") {
      sendClipboardText(message.content);
      toast({
        title: "Snippet beamed!",
        description: `Sent "${message.title}" to connected peer.`,
      });
    } else {
      toast({
        title: "Peer device not connected",
        description: "Open Connectivity or QR scanner to link your phone/laptop.",
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([message.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getTextMessageFilename(message.title, message.language);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const safeContent = message.content ?? "";
  const lines = safeContent.split("\n");
  const isMultiLine = lines.length > 5;
  const lang = (message.language || "plaintext").toLowerCase();
  const isCode = !["plaintext", "text", "chat"].includes(lang);
  const parsedDate = message.createdAt ? new Date(message.createdAt) : null;
  const isValidDate = parsedDate !== null && !Number.isNaN(parsedDate.getTime());
  const formattedTime = isValidDate ? format(parsedDate, "h:mm a") : "Just now";
  const relativeTime = isValidDate ? formatDistanceToNow(parsedDate, { addSuffix: true }) : "recently";

  return (
    <article className="group overflow-hidden rounded-xl border border-border/80 bg-card hover:border-foreground/20 transition-colors">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/70 border border-border/50 text-foreground/80">
            {isCode ? <Terminal className="h-4 w-4 text-primary" /> : <FileCode2 className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-foreground tracking-tight">
              {message.title || "Untitled"}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
              <span className="capitalize font-medium text-foreground/75">{message.language || "Text"}</span>
              <span aria-hidden="true">·</span>
              <span>{formattedTime}</span>
              <span aria-hidden="true">·</span>
              <span>{relativeTime}</span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBeam}
            title="Beam via P2P"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="sr-only">Beam</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            title="Download file"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="sr-only">Download</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            title="Copy content"
            className="h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>

          {showDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(message.id)}
              title="Delete snippet"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          )}
        </div>
      </div>

      {/* Snippet body */}
      <div className="relative bg-muted/25">
        <pre
          className={cn(
            "px-4 py-3.5 text-xs leading-relaxed text-foreground/95 [tab-size:2] overflow-x-auto whitespace-pre-wrap break-words",
            isCode ? "font-mono" : "font-sans text-[13px]",
            !isExpanded && isMultiLine && "max-h-44 overflow-y-hidden"
          )}
        >
          {message.content}
        </pre>

        {isMultiLine && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>

      {isMultiLine && (
        <div className="px-4 py-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono tabular-nums text-[11px]">{lines.length} lines</span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
          >
            <span>{isExpanded ? "Collapse" : "Show all"}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </article>
  );
}