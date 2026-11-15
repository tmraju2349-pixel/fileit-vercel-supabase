import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";

export type ClipboardPermissionState = "granted" | "prompt" | "denied" | "unsupported";

export interface SyncedClipboardItem {
  id: string;
  type: "text" | "link" | "image";
  content: string;
  timestamp: number;
  sourceDevice: string;
  hash: string;
  direction?: "sent" | "received";
  appliedToOs?: boolean;
}

export interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  fileRef?: File;
  folderPath?: string;
}

export interface ReceivedItem {
  id: string;
  type: "text" | "file";
  name?: string;
  text?: string;
  blobUrl?: string;
  size?: number;
  timestamp: string;
}

export type P2PState = "idle" | "creating" | "waiting_for_peer" | "connecting" | "connected" | "disconnected";

interface P2PConnectionContextType {
  p2pState: P2PState;
  connectionRole: "initiator" | "receiver" | null;
  sessionCode: string;
  enteredCode: string;
  setEnteredCode: (code: string) => void;
  remoteDeviceName: string;
  latency: number | null;
  logs: string[];
  addLog: (msg: string) => void;

  startAsInitiator: () => Promise<string>;
  startAsReceiver: (codeToJoin?: string) => Promise<boolean>;
  disconnect: () => void;
  sendDataChannelMessage: (msg: any) => boolean;

  syncedClipboard: SyncedClipboardItem[];
  latestRemoteClipboard: SyncedClipboardItem | null;
  pendingOsClipboardItem: SyncedClipboardItem | null;
  lastClipboardSyncAt: number | null;
  clipboardPermissionState: ClipboardPermissionState;
  sendClipboardText: (text: string) => void;
  clearClipboard: () => void;
  autoClipboardSync: boolean;
  setAutoClipboardSync: (enabled: boolean) => void;
  pasteFromSystemClipboard: () => Promise<void>;
  syncLocalClipboardNow: (origin?: "copy" | "focus" | "poll" | "manual") => Promise<boolean>;
  requestClipboardPermission: () => Promise<boolean>;
  applyPendingClipboard: () => Promise<boolean>;
  dismissPendingClipboard: () => void;

  remoteVaultFiles: VaultFile[];
  localVaultFiles: VaultFile[];
  setLocalVaultFiles: React.Dispatch<React.SetStateAction<VaultFile[]>>;
  addLocalFilesToVault: (files: File[], folderPath?: string) => void;
  removeLocalVaultFile: (id: string) => void;
  requestRemoteFile: (fileId: string) => void;
  syncAllRemoteFiles: () => void;

  sendFilesDirect: (files: File[]) => Promise<void>;
  isTransferring: boolean;
  transferProgress: number;
  transferSpeed: number;
  receivedItems: ReceivedItem[];
  clearReceivedItems: () => void;
}

const P2PConnectionContext = createContext<P2PConnectionContextType | undefined>(undefined);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

function getDeviceName(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android Phone";
  if (/iPad|iPhone|iPod/.test(ua)) return "iPhone / iPad";
  if (/Macintosh|Mac OS X/.test(ua)) return "MacBook";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux PC";
  return "Connected Device";
}

function hashClipboardText(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((i + 1) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}_${input.length}`;
}

function getSelectedTextFallback(): string {
  if (typeof document === "undefined") return "";
  try {
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (
      active &&
      (active.tagName === "TEXTAREA" || active.tagName === "INPUT") &&
      typeof active.selectionStart === "number" &&
      typeof active.selectionEnd === "number" &&
      active.selectionEnd > active.selectionStart
    ) {
      return active.value.slice(active.selectionStart, active.selectionEnd);
    }
    const sel = window.getSelection()?.toString();
    return sel || "";
  } catch {
    return "";
  }
}

export function P2PConnectionProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const {
    setConnectedPeer,
    setIsIslandMinimizedToLine,
    startTransfer,
    updateTransferProgress,
    completeTransfer,
  } = useDynamicBubble();

  const [p2pState, setP2PState] = useState<P2PState>("idle");
  const [connectionRole, setConnectionRole] = useState<"initiator" | "receiver" | null>(null);
  const [sessionCode, setSessionCode] = useState<string>("");
  const [enteredCode, setEnteredCode] = useState<string>("");
  const [remoteDeviceName, setRemoteDeviceName] = useState<string>("Paired Device");
  const [latency, setLatency] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [syncedClipboard, setSyncedClipboard] = useState<SyncedClipboardItem[]>([]);
  const [latestRemoteClipboard, setLatestRemoteClipboard] = useState<SyncedClipboardItem | null>(null);
  const [pendingOsClipboardItem, setPendingOsClipboardItem] = useState<SyncedClipboardItem | null>(null);
  const [lastClipboardSyncAt, setLastClipboardSyncAt] = useState<number | null>(null);
  const [clipboardPermissionState, setClipboardPermissionState] = useState<ClipboardPermissionState>("prompt");
  const [autoClipboardSync, setAutoClipboardSyncState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("fileit_auto_clipboard_sync");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  const setAutoClipboardSync = useCallback((enabled: boolean) => {
    setAutoClipboardSyncState(enabled);
    try {
      localStorage.setItem("fileit_auto_clipboard_sync", String(enabled));
    } catch {}
  }, []);
  const autoClipboardSyncRef = useRef<boolean>(autoClipboardSync);
  useEffect(() => {
    autoClipboardSyncRef.current = autoClipboardSync;
  }, [autoClipboardSync]);

  const lastProcessedHashRef = useRef<string>("");
  const lastBroadcastedTextRef = useRef<string>("");
  const [remoteVaultFiles, setRemoteVaultFiles] = useState<VaultFile[]>([]);
  const [localVaultFiles, setLocalVaultFiles] = useState<VaultFile[]>([]);
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);

  // WebRTC Native References (Persistent Singletons across navigation!)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const candidatePollingRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

  // Chunk Reception Buffers
  const incomingChunksRef = useRef<Map<string, { chunks: ArrayBuffer[]; receivedBytes: number; meta: any }>>(new Map());

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Update Dynamic Island on connection changes
  useEffect(() => {
    if (p2pState === "connected") {
      setConnectedPeer({
        id: sessionCode || "p2p-session",
        name: remoteDeviceName || "Paired Device",
        deviceType: /phone|android|iphone/i.test(remoteDeviceName) ? "mobile" : "desktop",
        connectedAt: Date.now(),
        isDirectP2P: true,
        roomCode: sessionCode,
      });
    } else {
      setConnectedPeer(null);
    }
  }, [p2pState, sessionCode, remoteDeviceName, setConnectedPeer]);

  // Safe DataChannel Send
  const sendDataChannelMessage = useCallback((msgObj: any): boolean => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      try {
        dataChannelRef.current.send(JSON.stringify(msgObj));
        return true;
      } catch (err) {
        console.error("DataChannel send failed:", err);
      }
    }
    return false;
  }, []);

  // ── Setup DataChannel & Message Handlers ─────────────────────────────────────
  const setupDataChannelEvents = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      setP2PState("connected");
      addLog("P2P DataChannel established! (Persistent across navigation)");
      toast({
        title: "Devices Linked Successfully",
        description: "Clipboard Sync and Bi-Directional Folder Access are now active.",
      });

      // Send Handshake with local vault file manifest
      sendDataChannelMessage({
        type: "HANDSHAKE",
        deviceName: getDeviceName(),
        vaultFiles: localVaultFiles.map(({ fileRef, ...meta }) => meta),
      });

      // Start 4-second Keep-Alive Heartbeat loop
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (channel.readyState === "open") {
          channel.send(JSON.stringify({ type: "PING", t: Date.now() }));
        }
      }, 4000);
    };

    channel.onclose = () => {
      setP2PState("disconnected");
      addLog("DataChannel closed.");
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    channel.onerror = (err) => {
      console.warn("DataChannel error:", err);
      addLog("DataChannel error encountered.");
    };

    channel.onmessage = (event) => {
      // 1. Binary ArrayBuffer chunk received
      if (typeof event.data !== "string") {
        const buffer = event.data as ArrayBuffer;
        const headerView = new Uint8Array(buffer, 0, 16);
        const headerStr = new TextDecoder().decode(headerView).trim();
        const payload = buffer.slice(16);

        const transfer = incomingChunksRef.current.get(headerStr);
        if (transfer) {
          transfer.chunks.push(payload);
          transfer.receivedBytes += payload.byteLength;
          const prog = Math.min(100, Math.round((transfer.receivedBytes / transfer.meta.fileSize) * 100));
          setTransferProgress(prog);
          updateTransferProgress(transfer.meta.fileId, prog, 8.5);

          if (transfer.receivedBytes >= transfer.meta.fileSize) {
            // File completed
            const blob = new Blob(transfer.chunks, { type: transfer.meta.mimeType || "application/octet-stream" });
            const blobUrl = URL.createObjectURL(blob);
            setReceivedItems((prev) => [
              {
                id: transfer.meta.fileId,
                type: "file",
                name: transfer.meta.fileName,
                blobUrl,
                size: transfer.meta.fileSize,
                timestamp: new Date().toLocaleTimeString(),
              },
              ...prev,
            ]);
            completeTransfer(transfer.meta.fileId);
            incomingChunksRef.current.delete(headerStr);
            setIsTransferring(false);
            setTransferProgress(0);
            toast({
              title: "File Received via P2P",
              description: `${transfer.meta.fileName} received directly into memory.`,
            });
          }
        }
        return;
      }

      // 2. JSON control / manifest messages
      try {
        const msg = JSON.parse(event.data);

        // Heartbeat Ping / Pong
        if (msg.type === "PING") {
          sendDataChannelMessage({ type: "PONG", t: msg.t });
          return;
        }
        if (msg.type === "PONG") {
          const rtt = Math.max(1, Date.now() - msg.t);
          setLatency(rtt);
          return;
        }

        // Handshake
        if (msg.type === "HANDSHAKE") {
          setRemoteDeviceName(msg.deviceName || "Paired Device");
          if (Array.isArray(msg.vaultFiles)) {
            setRemoteVaultFiles(msg.vaultFiles);
          }
          addLog(`Paired with ${msg.deviceName}`);
          return;
        }

        // Remote Vault Manifest Update
        if (msg.type === "VAULT_MANIFEST") {
          if (Array.isArray(msg.files)) {
            setRemoteVaultFiles(msg.files);
            addLog(`Updated remote folder manifest: ${msg.files.length} items`);
          }
          return;
        }

        // Clipboard Sync Item Received
        if (msg.type === "CLIPBOARD_SYNC" && msg.item && typeof msg.item.content === "string" && msg.item.content.trim()) {
          const cleanContent = msg.item.content.trim();
          const computedHash = hashClipboardText(cleanContent);
          if (computedHash === lastProcessedHashRef.current && cleanContent === lastBroadcastedTextRef.current) {
            return;
          }

          lastProcessedHashRef.current = computedHash;
          lastBroadcastedTextRef.current = cleanContent;

          const receivedItem: SyncedClipboardItem = {
            id: msg.item.id || `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: /^https?:\/\//i.test(cleanContent) ? "link" : msg.item.type || "text",
            content: cleanContent,
            timestamp: msg.item.timestamp || Date.now(),
            sourceDevice: msg.item.sourceDevice || "Paired Device",
            hash: computedHash,
            direction: "received",
            appliedToOs: false,
          };

          setLatestRemoteClipboard(receivedItem);
          setLastClipboardSyncAt(Date.now());
          setSyncedClipboard((prev) => {
            const filtered = prev.filter((existing) => existing.hash !== computedHash);
            return [receivedItem, ...filtered].slice(0, 25);
          });

          const tryWriteToOs = async () => {
            if (!autoClipboardSyncRef.current) return;
            if (typeof navigator === "undefined" || !navigator?.clipboard?.writeText) {
              setPendingOsClipboardItem(receivedItem);
              setIsIslandMinimizedToLine(false);
              return;
            }
            if (typeof document !== "undefined" && (document.visibilityState !== "visible" || !document.hasFocus())) {
              setPendingOsClipboardItem(receivedItem);
              setIsIslandMinimizedToLine(false);
              return;
            }
            try {
              await navigator.clipboard.writeText(cleanContent);
              const appliedItem = { ...receivedItem, appliedToOs: true };
              setPendingOsClipboardItem(null);
              setLatestRemoteClipboard(appliedItem);
              setSyncedClipboard((prev) =>
                prev.map((entry) => (entry.id === receivedItem.id ? { ...entry, appliedToOs: true } : entry))
              );
              toast({
                title: `Copied from ${receivedItem.sourceDevice}`,
                description: `${cleanContent.length > 55 ? cleanContent.slice(0, 55) + "..." : cleanContent} · Ready to paste`,
              });
            } catch {
              setPendingOsClipboardItem(receivedItem);
              setIsIslandMinimizedToLine(false);
              toast({
                title: `Clipboard ready from ${receivedItem.sourceDevice}`,
                description: "Switch to this tab or tap Apply in Fileit Island to write to OS clipboard.",
              });
            }
          };

          void tryWriteToOs();
          return;
        }

        // Remote File Transfer Start
        if (msg.type === "FILE_START") {
          incomingChunksRef.current.set(msg.fileId, {
            chunks: [],
            receivedBytes: 0,
            meta: msg,
          });
          setIsTransferring(true);
          setTransferProgress(0);
          startTransfer({
            id: msg.fileId,
            name: msg.fileName,
            type: "p2p",
            progress: 0,
            speedMBps: 8.5,
          });
          return;
        }

        // Request File from this device
        if (msg.type === "REQUEST_FILE") {
          const target = localVaultFiles.find((f) => f.id === msg.fileId);
          if (target && target.fileRef) {
            addLog(`Fulfilling remote request for ${target.name}`);
            sendFilesDirect([target.fileRef]);
          }
          return;
        }
      } catch (err) {
        console.warn("Failed to parse DataChannel message:", err);
      }
    };
  }, [addLog, toast, localVaultFiles, sendDataChannelMessage, startTransfer, updateTransferProgress, completeTransfer, setIsIslandMinimizedToLine]);

  // Clean Disconnect (Only when explicitly called or tab closed!)
  const disconnect = useCallback(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (candidatePollingRef.current) clearInterval(candidatePollingRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setP2PState("idle");
    setSessionCode("");
    setConnectionRole(null);
    setRemoteDeviceName("Paired Device");
    setLatency(null);
    setRemoteVaultFiles([]);
    addLog("Disconnected session.");
    toast({ title: "Session Disconnected" });
  }, [addLog, toast]);

  // ── INITIATOR FLOW (Creates session and QR) ──────────────────────────────────
  const startAsInitiator = useCallback(async (): Promise<string> => {
    try {
      disconnect();
      setP2PState("creating");
      addLog("Creating WebRTC session...");

      const res = await fetch("/api/webrtc/session", { method: "POST" });
      if (!res.ok) throw new Error("Could not create signaling session");
      const { code } = await res.json();
      setSessionCode(code);
      setConnectionRole("initiator");

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch(`/api/webrtc/session/${code}/candidates/initiator`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate: event.candidate }),
            });
          } catch {}
        }
      };

      // Create DataChannel
      const dc = pc.createDataChannel("fileit-data", { ordered: true });
      dataChannelRef.current = dc;
      setupDataChannelEvents(dc);

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch(`/api/webrtc/session/${code}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer }),
      });

      setP2PState("waiting_for_peer");
      addLog(`Session ${code} ready. Waiting for peer...`);

      // Poll for Answer
      const pollInterval = window.setInterval(async () => {
        try {
          const ansRes = await fetch(`/api/webrtc/session/${code}/answer`);
          if (ansRes.status === 200) {
            const { answer } = await ansRes.json();
            clearInterval(pollInterval);
            pollingIntervalRef.current = null;

            if (pc.signalingState !== "closed" && !pc.currentRemoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              setP2PState("connecting");
              addLog("Peer answered! Negotiating connection...");

              // Fetch receiver ICE candidates
              const candRes = await fetch(`/api/webrtc/session/${code}/candidates/receiver`);
              if (candRes.ok) {
                const { candidates } = await candRes.json();
                for (const c of candidates) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(c));
                  } catch {}
                }
              }
            }
          }
        } catch {}
      }, 1500);
      pollingIntervalRef.current = pollInterval;

      return code;
    } catch (err: any) {
      setP2PState("idle");
      addLog(`Failed to create session: ${err?.message || err}`);
      toast({ variant: "destructive", title: "Signaling Failed", description: "Could not create peer session." });
      throw err;
    }
  }, [disconnect, addLog, setupDataChannelEvents, toast]);

  // ── RECEIVER FLOW (Scans QR or enters code) ─────────────────────────────────
  const startAsReceiver = useCallback(async (codeToJoin?: string): Promise<boolean> => {
    const code = (codeToJoin || enteredCode).trim();
    if (!code) {
      toast({ variant: "destructive", title: "Invalid Code", description: "Please enter or scan a valid session code." });
      return false;
    }

    try {
      disconnect();
      setP2PState("connecting");
      setSessionCode(code);
      setConnectionRole("receiver");
      addLog(`Connecting to session ${code}...`);

      const sessionRes = await fetch(`/api/webrtc/session/${code}`);
      if (!sessionRes.ok) {
        throw new Error("Session not found or expired");
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        setupDataChannelEvents(event.channel);
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch(`/api/webrtc/session/${code}/candidates/receiver`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate: event.candidate }),
            });
          } catch {}
        }
      };

      // Poll for offer if not ready
      let offer: any = null;
      let attempts = 0;
      while (!offer && attempts < 15) {
        const offRes = await fetch(`/api/webrtc/session/${code}/offer`);
        if (offRes.status === 200) {
          const data = await offRes.json();
          offer = data.offer;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;
      }

      if (!offer) {
        throw new Error("Host offer timed out");
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`/api/webrtc/session/${code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });

      // Fetch initiator candidates
      const candRes = await fetch(`/api/webrtc/session/${code}/candidates/initiator`);
      if (candRes.ok) {
        const { candidates } = await candRes.json();
        for (const c of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        }
      }

      addLog("Answer sent! Connecting direct stream...");
      return true;
    } catch (err: any) {
      setP2PState("idle");
      addLog(`Join error: ${err?.message || err}`);
      toast({ variant: "destructive", title: "Connection Failed", description: err?.message || "Could not link to host." });
      return false;
    }
  }, [enteredCode, disconnect, addLog, setupDataChannelEvents, toast]);

  // ── Monitor Browser Clipboard Read Permission ───────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setClipboardPermissionState("unsupported");
      return;
    }

    let permStatus: PermissionStatus | null = null;
    let active = true;

    const checkPerm = async () => {
      if (!navigator.permissions?.query) return;
      try {
        const status = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
        if (!active) return;
        permStatus = status;
        setClipboardPermissionState(status.state as ClipboardPermissionState);
        status.onchange = () => {
          if (active) {
            setClipboardPermissionState(status.state as ClipboardPermissionState);
          }
        };
      } catch {
        // Safari/Firefox may not expose clipboard-read in Permissions API
      }
    };

    void checkPerm();
    return () => {
      active = false;
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  // ── Clipboard Sync & Bi-Directional Auto-Pairing ──────────────────────────
  const sendClipboardText = useCallback((text: string) => {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    const hash = hashClipboardText(clean);

    // Prevent echoing back the item we just sent or received
    if (hash === lastProcessedHashRef.current && clean === lastBroadcastedTextRef.current) {
      return;
    }

    lastProcessedHashRef.current = hash;
    lastBroadcastedTextRef.current = clean;

    const item: SyncedClipboardItem = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: /^https?:\/\//i.test(clean) ? "link" : "text",
      content: clean,
      timestamp: Date.now(),
      sourceDevice: getDeviceName(),
      hash,
      direction: "sent",
      appliedToOs: true,
    };

    setLastClipboardSyncAt(Date.now());
    setSyncedClipboard((prev) => {
      const filtered = prev.filter((existing) => existing.hash !== hash);
      return [item, ...filtered].slice(0, 25);
    });
    sendDataChannelMessage({ type: "CLIPBOARD_SYNC", item });
  }, [sendDataChannelMessage]);

  const applyPendingClipboard = useCallback(async (): Promise<boolean> => {
    if (!pendingOsClipboardItem) return false;
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(pendingOsClipboardItem.content);
      const targetId = pendingOsClipboardItem.id;
      const preview = pendingOsClipboardItem.content;
      setPendingOsClipboardItem(null);
      setLatestRemoteClipboard((prev) => (prev && prev.id === targetId ? { ...prev, appliedToOs: true } : prev));
      setSyncedClipboard((prev) =>
        prev.map((entry) => (entry.id === targetId ? { ...entry, appliedToOs: true } : entry))
      );
      toast({
        title: "Clipboard updated",
        description: `${preview.length > 50 ? preview.slice(0, 50) + "..." : preview}`,
      });
      return true;
    } catch {
      return false;
    }
  }, [pendingOsClipboardItem, toast]);

  const dismissPendingClipboard = useCallback(() => {
    setPendingOsClipboardItem(null);
  }, []);

  const syncLocalClipboardNow = useCallback(
    async (origin: "copy" | "focus" | "poll" | "manual" = "manual"): Promise<boolean> => {
      if (p2pState !== "connected") return false;

      let candidateText = "";
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.readText && document.hasFocus()) {
          candidateText = await navigator.clipboard.readText();
          setClipboardPermissionState("granted");
        }
      } catch (err: any) {
        if (origin === "manual" && err?.name === "NotAllowedError") {
          setClipboardPermissionState("denied");
        }
      }

      if (!candidateText && (origin === "copy" || origin === "manual")) {
        candidateText = getSelectedTextFallback();
      }

      const clean = candidateText.trim();
      if (!clean) return false;

      const hash = hashClipboardText(clean);
      if (hash === lastProcessedHashRef.current && clean === lastBroadcastedTextRef.current) {
        return false;
      }

      sendClipboardText(clean);
      if (origin === "focus") {
        toast({
          title: "Synced clipboard on tab return",
          description: `${clean.length > 48 ? clean.slice(0, 48) + "..." : clean}`,
        });
      }
      return true;
    },
    [p2pState, sendClipboardText, toast]
  );

  const requestClipboardPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      setClipboardPermissionState("unsupported");
      toast({
        variant: "destructive",
        title: "Clipboard Read Unsupported",
        description: "In-app copies still sync automatically, or paste manually in the box.",
      });
      return false;
    }

    try {
      const text = await navigator.clipboard.readText();
      setClipboardPermissionState("granted");
      if (text && text.trim() && p2pState === "connected") {
        const clean = text.trim();
        const hash = hashClipboardText(clean);
        if (hash !== lastProcessedHashRef.current) {
          sendClipboardText(clean);
        }
      }
      toast({
        title: "Auto-Clipboard Access Enabled",
        description: "Copying in other apps will auto-sync when you switch back to Fileit.",
      });
      return true;
    } catch {
      setClipboardPermissionState("denied");
      toast({
        variant: "destructive",
        title: "Clipboard Permission Blocked",
        description: "Allow clipboard access in browser site settings, or paste directly into Fileit.",
      });
      return false;
    }
  }, [p2pState, sendClipboardText, toast]);

  const pasteFromSystemClipboard = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
        toast({
          variant: "destructive",
          title: "Clipboard Access Limited",
          description: "Use Ctrl+V / Cmd+V to paste directly into Fileit.",
        });
        return;
      }
      const text = await navigator.clipboard.readText();
      setClipboardPermissionState("granted");
      if (!text || !text.trim()) {
        toast({ title: "Clipboard Empty", description: "No text found in system clipboard." });
        return;
      }
      sendClipboardText(text);
      toast({
        title: "Clipboard Beamed",
        description: `Shared "${text.length > 40 ? text.slice(0, 40) + "..." : text}" to paired device.`,
      });
    } catch {
      toast({
        title: "Click to Allow Clipboard",
        description: "Browser requires permission to read system clipboard.",
      });
    }
  }, [sendClipboardText, toast]);

  // Auto-flush any pending remote clipboard write when returning to tab or on next interaction
  useEffect(() => {
    if (!pendingOsClipboardItem) return;

    const flushSync = () => {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
      navigator.clipboard
        .writeText(pendingOsClipboardItem.content)
        .then(() => {
          const targetId = pendingOsClipboardItem.id;
          const preview = pendingOsClipboardItem.content;
          setPendingOsClipboardItem(null);
          setLatestRemoteClipboard((prev) => (prev && prev.id === targetId ? { ...prev, appliedToOs: true } : prev));
          setSyncedClipboard((prev) =>
            prev.map((entry) => (entry.id === targetId ? { ...entry, appliedToOs: true } : entry))
          );
          toast({
            title: "Applied pending clipboard",
            description: `${preview.length > 50 ? preview.slice(0, 50) + "..." : preview}`,
          });
        })
        .catch(() => {});
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        setTimeout(flushSync, 40);
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("pointerdown", flushSync, { passive: true });
    window.addEventListener("keydown", flushSync, { passive: true });

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("pointerdown", flushSync);
      window.removeEventListener("keydown", flushSync);
    };
  }, [pendingOsClipboardItem, toast]);

  // Automatic bidirectional sync when site is open & on switching back to Fileit
  useEffect(() => {
    if (p2pState !== "connected" || !autoClipboardSync) return;

    const handleDocumentCopyOrCut = () => {
      // Immediate capture via selection fallback + async readText verification
      const immediateSelection = getSelectedTextFallback();
      if (immediateSelection && immediateSelection.trim()) {
        const clean = immediateSelection.trim();
        if (hashClipboardText(clean) !== lastProcessedHashRef.current) {
          sendClipboardText(clean);
        }
      }
      setTimeout(() => {
        void syncLocalClipboardNow("copy");
      }, 60);
    };

    const handleWindowReturn = () => {
      if (document.visibilityState === "visible") {
        setTimeout(() => {
          void syncLocalClipboardNow("focus");
        }, 80);
      }
    };

    window.addEventListener("copy", handleDocumentCopyOrCut);
    window.addEventListener("cut", handleDocumentCopyOrCut);
    window.addEventListener("focus", handleWindowReturn);
    document.addEventListener("visibilitychange", handleWindowReturn);

    // Gentle focused polling when clipboard-read permission is already granted
    let pollInterval: number | null = null;
    if (clipboardPermissionState === "granted") {
      pollInterval = window.setInterval(() => {
        if (document.visibilityState === "visible" && document.hasFocus()) {
          void syncLocalClipboardNow("poll");
        }
      }, 1500);
    }

    return () => {
      window.removeEventListener("copy", handleDocumentCopyOrCut);
      window.removeEventListener("cut", handleDocumentCopyOrCut);
      window.removeEventListener("focus", handleWindowReturn);
      document.removeEventListener("visibilitychange", handleWindowReturn);
      if (pollInterval !== null) clearInterval(pollInterval);
    };
  }, [p2pState, autoClipboardSync, clipboardPermissionState, sendClipboardText, syncLocalClipboardNow]);

  const clearClipboard = useCallback(() => {
    setSyncedClipboard([]);
    setLatestRemoteClipboard(null);
    setPendingOsClipboardItem(null);
  }, []);

  // ── Vault Management & Bi-Directional Folder Sync ───────────────────────────
  const addLocalFilesToVault = useCallback((files: File[], folderPath?: string) => {
    const newItems: VaultFile[] = files.map((f) => ({
      id: `vault_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
      lastModified: f.lastModified || Date.now(),
      fileRef: f,
      folderPath: folderPath || (f as any).webkitRelativePath ? (f as any).webkitRelativePath.split("/").slice(0, -1).join("/") : "",
    }));

    setLocalVaultFiles((prev) => {
      const merged = [...newItems, ...prev];
      // Broadcast updated manifest to peer
      sendDataChannelMessage({
        type: "VAULT_MANIFEST",
        files: merged.map(({ fileRef, ...meta }) => meta),
      });
      return merged;
    });

    toast({
      title: `${files.length} Item${files.length > 1 ? "s" : ""} Added to Local Vault`,
      description: "Manifest automatically synchronized to paired device.",
    });
  }, [sendDataChannelMessage, toast]);

  const removeLocalVaultFile = useCallback((id: string) => {
    setLocalVaultFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      sendDataChannelMessage({
        type: "VAULT_MANIFEST",
        files: filtered.map(({ fileRef, ...meta }) => meta),
      });
      return filtered;
    });
  }, [sendDataChannelMessage]);

  const requestRemoteFile = useCallback((fileId: string) => {
    sendDataChannelMessage({ type: "REQUEST_FILE", fileId });
    toast({ title: "Requesting File from Peer", description: "Stream starting via direct DataChannel..." });
  }, [sendDataChannelMessage, toast]);

  const syncAllRemoteFiles = useCallback(() => {
    if (remoteVaultFiles.length === 0) return;
    toast({ title: "Syncing Remote Folder", description: `Requesting ${remoteVaultFiles.length} files...` });
    remoteVaultFiles.forEach((file, idx) => {
      setTimeout(() => requestRemoteFile(file.id), idx * 400);
    });
  }, [remoteVaultFiles, requestRemoteFile, toast]);

  // ── Send Files Direct in Chunks (64KB ArrayBuffer) ──────────────────────────
  const sendFilesDirect = useCallback(async (files: File[]) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      toast({ variant: "destructive", title: "No Device Linked", description: "Pair a device to beam files." });
      return;
    }

    const channel = dataChannelRef.current;
    setIsTransferring(true);

    for (const file of files) {
      const fileId = Math.random().toString(36).substring(2, 9);
      const chunkSize = 16384; // 16KB per chunk for maximum WebRTC buffer safety

      sendDataChannelMessage({
        type: "FILE_START",
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      startTransfer({
        id: fileId,
        name: file.name,
        type: "p2p",
        progress: 0,
        speedMBps: 9.2,
      });

      const buffer = await file.arrayBuffer();
      let offset = 0;
      const headerBytes = new TextEncoder().encode(fileId.padEnd(16, " "));

      while (offset < buffer.byteLength) {
        // Handle bufferedAmount flow control to avoid WebRTC buffer overflow
        if (channel.bufferedAmount > 256 * 1024) {
          await new Promise((res) => setTimeout(res, 25));
        }

        const chunkData = buffer.slice(offset, offset + chunkSize);
        const packet = new Uint8Array(16 + chunkData.byteLength);
        packet.set(headerBytes, 0);
        packet.set(new Uint8Array(chunkData), 16);

        channel.send(packet.buffer);
        offset += chunkSize;

        const prog = Math.min(100, Math.round((offset / buffer.byteLength) * 100));
        setTransferProgress(prog);
        updateTransferProgress(fileId, prog, 9.2);
      }

      completeTransfer(fileId);
    }

    setIsTransferring(false);
    setTransferProgress(0);
    toast({ title: "Transfer Complete", description: "All files streamed to peer." });
  }, [sendDataChannelMessage, startTransfer, updateTransferProgress, completeTransfer, toast]);

  const clearReceivedItems = useCallback(() => {
    setReceivedItems([]);
  }, []);

  return (
    <P2PConnectionContext.Provider
      value={{
        p2pState,
        connectionRole,
        sessionCode,
        enteredCode,
        setEnteredCode,
        remoteDeviceName,
        latency,
        logs,
        addLog,

        startAsInitiator,
        startAsReceiver,
        disconnect,
        sendDataChannelMessage,

        syncedClipboard,
        latestRemoteClipboard,
        pendingOsClipboardItem,
        lastClipboardSyncAt,
        clipboardPermissionState,
        sendClipboardText,
        clearClipboard,
        autoClipboardSync,
        setAutoClipboardSync,
        pasteFromSystemClipboard,
        syncLocalClipboardNow,
        requestClipboardPermission,
        applyPendingClipboard,
        dismissPendingClipboard,

        remoteVaultFiles,
        localVaultFiles,
        setLocalVaultFiles,
        addLocalFilesToVault,
        removeLocalVaultFile,
        requestRemoteFile,
        syncAllRemoteFiles,

        sendFilesDirect,
        isTransferring,
        transferProgress,
        transferSpeed,
        receivedItems,
        clearReceivedItems,
      }}
    >
      {children}
    </P2PConnectionContext.Provider>
  );
}

export function useP2PConnection() {
  const context = useContext(P2PConnectionContext);
  if (!context) {
    throw new Error("useP2PConnection must be used within a P2PConnectionProvider");
  }
  return context;
}
