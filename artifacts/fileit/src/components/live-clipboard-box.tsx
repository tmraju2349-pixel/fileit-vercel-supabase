import React, { useState, useEffect, useRef } from "react";
import {
  Clipboard,
  ClipboardCheck,
  Copy,
  Check,
  Send,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useP2PConnection } from "@/components/p2p-connection-context";
import { useToast } from "@/hooks/use-toast";

export function LiveClipboardBox() {
  const { toast } = useToast();
  const {
    p2pState,
    remoteDeviceName,
    syncedClipboard,
    latestRemoteClipboard,
    pendingOsClipboardItem,
    lastClipboardSyncAt,
    clipboardPermissionState,
    autoClipboardSync,
    setAutoClipboardSync,
    sendClipboardText,
    clearClipboard,
    syncLocalClipboardNow,
    requestClipboardPermission,
    applyPendingClipboard,
    dismissPendingClipboard,
  } = useP2PConnection();

  const isConnected = p2pState === "connected";
  const latestItem = syncedClipboard[0] || null;

  const [boxText, setBoxText] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [flashReceived, setFlashReceived] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const lastSeenItemIdRef = useRef<string | null>(null);

  // Automatically populate the Live Shared Clipboard Box whenever new synced text arrives
  useEffect(() => {
    if (!latestItem) return;
    if (latestItem.id === lastSeenItemIdRef.current) return;
    lastSeenItemIdRef.current = latestItem.id;

    setBoxText(latestItem.content);
    setIsDirty(false);

    if (latestItem.direction === "received") {
      setFlashReceived(true);
      const timer = window.setTimeout(() => setFlashReceived(false), 900);
      return () => clearTimeout(timer);
    }
  }, [latestItem]);

  const handleCopyText = async (text: string, id: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ variant: "destructive", title: "Could not write to clipboard" });
    }
  };

  const handlePushBox = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isConnected || !boxText.trim()) return;
    sendClipboardText(boxText.trim());
    setIsDirty(false);
    toast({
      title: "Pushed to connected device",
      description: `Synced with ${remoteDeviceName || "paired device"}.`,
    });
  };

  const permissionLabel =
    clipboardPermissionState === "granted"
      ? "Tab-switch auto-read ready"
      : clipboardPermissionState === "prompt"
      ? "Grant clipboard permission for tab-switch sync"
      : clipboardPermissionState === "denied"
      ? "Tab-switch read blocked by browser"
      : "In-app copy sync active";

  return (
    <section
      aria-label="Live Shared Clipboard"
      className={`rounded-2xl bg-card border p-5 space-y-4 transition-colors duration-200 ${
        flashReceived ? "border-primary ring-2 ring-primary/20" : "border-border/80"
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Live Shared Clipboard
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className={isConnected && autoClipboardSync ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
              {!isConnected
                ? "Connect two devices to sync"
                : autoClipboardSync
                ? "Auto-sync active"
                : "Auto-sync paused"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{permissionLabel}</span>
            {lastClipboardSyncAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {new Date(lastClipboardSyncAt).toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {clipboardPermissionState === "prompt" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void requestClipboardPermission()}
              className="h-8 px-3 text-xs font-medium rounded-lg gap-1.5 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Enable Auto-Read</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isConnected}
            onClick={() => void syncLocalClipboardNow("manual")}
            className="h-8 px-3 text-xs font-medium rounded-lg gap-1.5 whitespace-nowrap shrink-0"
            title="Read your current OS clipboard and push to paired device"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Now</span>
          </Button>

          <button
            type="button"
            onClick={() => setAutoClipboardSync(!autoClipboardSync)}
            className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              autoClipboardSync
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {autoClipboardSync ? "Auto-Sync On" : "Auto-Sync Off"}
          </button>
        </div>
      </div>

      {/* Pending OS Clipboard Write Banner (When browser blocked background/gesture write) */}
      {pendingOsClipboardItem && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              Clipboard received from {pendingOsClipboardItem.sourceDevice}
            </p>
            <p className="text-muted-foreground truncate font-mono text-[11px]">
              Tap Apply to write to this device&apos;s OS clipboard: {pendingOsClipboardItem.content}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => void applyPendingClipboard()}
              className="h-7 px-3 rounded-lg text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Apply to Clipboard</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={dismissPendingClipboard}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Live Shared Box */}
      <form onSubmit={handlePushBox} className="space-y-2.5">
        <div className="relative">
          <textarea
            value={boxText}
            onChange={(e) => {
              setBoxText(e.target.value);
              setIsDirty(true);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handlePushBox();
              }
            }}
            rows={3}
            placeholder={
              isConnected
                ? "Copy text anywhere on this site, or switch back from another app to auto-sync here..."
                : "Pair two devices to start automatic live clipboard sharing..."
            }
            className="w-full rounded-xl bg-secondary/35 border border-border/80 px-3.5 py-2.5 text-sm font-mono text-foreground placeholder:font-sans placeholder:text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[82px]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-muted-foreground font-mono tabular-nums flex items-center gap-2">
            <span>{boxText.length} chars</span>
            {latestItem && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans">
                  {latestItem.direction === "received"
                    ? `From ${latestItem.sourceDevice}`
                    : "Sent from this device"}
                </span>
                {latestItem.direction === "received" && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans">
                      {latestItem.appliedToOs ? "In OS clipboard" : "Waiting to apply"}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!boxText.trim()}
              onClick={() => void handleCopyText(boxText, "live-box")}
              className="h-8 px-3 rounded-lg text-xs font-medium gap-1.5 whitespace-nowrap"
            >
              {copiedId === "live-box" ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedId === "live-box" ? "Copied" : "Copy"}</span>
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={!isConnected || !boxText.trim()}
              className="h-8 px-3.5 rounded-lg text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isDirty ? "Send Update" : "Push to Peer"}</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Rolling Sync History */}
      {syncedClipboard.length > 0 && (
        <div className="pt-2 border-t border-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              Recent History ({syncedClipboard.length})
            </span>
            <button
              type="button"
              onClick={clearClipboard}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>

          <div className="divide-y divide-border/50 max-h-40 overflow-y-auto">
            {syncedClipboard.slice(0, 8).map((item) => (
              <div key={item.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono tabular-nums">
                    <span className="font-sans font-medium text-foreground">
                      {item.direction === "received" ? "Received" : "Sent"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans truncate">{item.sourceDevice}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-foreground/90 font-mono text-xs truncate">{item.content}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => void handleCopyText(item.content, item.id)}
                    className="h-7 w-7 rounded-lg"
                    title="Copy to OS clipboard"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  {isConnected && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => sendClipboardText(item.content)}
                      className="h-7 w-7 rounded-lg"
                      title="Re-send to peer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keep reference clear when latestRemoteClipboard differs */}
      {latestRemoteClipboard && !boxText && (
        <button
          type="button"
          onClick={() => setBoxText(latestRemoteClipboard.content)}
          className="text-xs text-primary hover:underline"
        >
          Load latest received clipboard ({latestRemoteClipboard.content.slice(0, 32)})
        </button>
      )}
    </section>
  );
}
