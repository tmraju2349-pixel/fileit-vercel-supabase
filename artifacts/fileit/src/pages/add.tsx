import React, { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useCreateTextMessage, useListFolders } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useP2PConnection } from "@/components/p2p-connection-context";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  FileText,
  Code2,
  Send,
  Radio,
  Copy,
  Check,
  RotateCcw,
  Folder,
  ArrowUpRight,
  ClipboardPaste,
  Undo2,
  X,
} from "lucide-react";

const LANGUAGES = [
  { id: "plaintext", name: "Plain Text", ext: "txt" },
  { id: "python", name: "Python", ext: "py" },
  { id: "javascript", name: "JavaScript", ext: "js" },
  { id: "typescript", name: "TypeScript", ext: "ts" },
  { id: "html", name: "HTML", ext: "html" },
  { id: "css", name: "CSS", ext: "css" },
  { id: "json", name: "JSON", ext: "json" },
  { id: "sql", name: "SQL", ext: "sql" },
  { id: "bash", name: "Bash / Shell", ext: "sh" },
  { id: "rust", name: "Rust", ext: "rs" },
  { id: "cpp", name: "C++", ext: "cpp" },
  { id: "java", name: "Java", ext: "java" },
  { id: "go", name: "Go", ext: "go" },
  { id: "markdown", name: "Markdown", ext: "md" },
];

function detectSyntax(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 8) return null;

  if (/(^def\s+\w+\(|^import\s+\w+|^from\s+\w+\s+import|print\(|elif\s+:|__init__|:\s*$)/m.test(trimmed)) {
    return "python";
  }
  if (/(const\s+\w+\s*=|let\s+\w+\s*=|function\s*\w*\(|import\s+.*from\s+['"]|export\s+(default|const|function)|console\.log|=>\s*\{|<[A-Z]\w+.*>|interface\s+\w+|type\s+\w+\s*=)/m.test(trimmed)) {
    return trimmed.includes("interface ") || trimmed.includes("type ") || trimmed.includes(": React.")
      ? "typescript"
      : "javascript";
  }
  if (/^<!DOCTYPE|<html|<div|<svg|<body|<head|<\/\w+>/i.test(trimmed)) {
    return "html";
  }
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {}
  }
  if (/^(SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM)/im.test(trimmed)) {
    return "sql";
  }
  if (/(^#!\/bin\/(bash|sh)|sudo\s+\w+|npm\s+(run|install)|docker\s+run|git\s+(commit|push|pull|status)|curl\s+-)/m.test(trimmed)) {
    return "bash";
  }
  if (/#include\s*<.*>|int\s+main\s*\(|std::cout|printf\(/.test(trimmed)) {
    return "cpp";
  }
  if (/fn\s+main\s*\(|println!\(|let\s+mut\s+|impl\s+\w+/.test(trimmed)) {
    return "rust";
  }
  if (/^package\s+main|func\s+\w+\(|fmt\.Print/.test(trimmed)) {
    return "go";
  }
  if (/public\s+class\s+\w+|System\.out\.print/.test(trimmed)) {
    return "java";
  }
  if (/^#+\s+\w+|^[-*]\s+\w+|```\w*/m.test(trimmed)) {
    return "markdown";
  }
  return null;
}

interface SessionSavedEntry {
  id: string;
  title: string;
  language: string;
}

export default function AddPage() {
  const [mode, setMode] = useState<"text" | "code">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("plaintext");
  const [autoDetected, setAutoDetected] = useState<string | null>(null);
  const [userManuallySelectedLang, setUserManuallySelectedLang] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [recentSaved, setRecentSaved] = useState<SessionSavedEntry[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMessage = useCreateTextMessage();
  const {
    p2pState,
    sendClipboardText,
    remoteDeviceName,
    latestRemoteClipboard,
    autoClipboardSync,
  } = useP2PConnection();
  const { data: folders } = useListFolders();

  const isConnected = p2pState === "connected";

  const mountedAtRef = useRef<number>(Date.now());
  const lastAutoPastedIdRef = useRef<string | null>(
    latestRemoteClipboard && latestRemoteClipboard.timestamp < mountedAtRef.current - 4000
      ? latestRemoteClipboard.id
      : null
  );
  const lastAutoPastedTextRef = useRef<string | null>(null);
  const [autoPasteBanner, setAutoPasteBanner] = useState<{
    sourceDevice: string;
    charCount: number;
    prevContent: string;
    prevMode: "text" | "code";
    prevLang: string;
  } | null>(null);

  // Auto-paste incoming synced clipboard text into the active Add editor
  useEffect(() => {
    if (!autoClipboardSync || !latestRemoteClipboard) return;
    if (latestRemoteClipboard.direction !== "received") return;
    if (latestRemoteClipboard.id === lastAutoPastedIdRef.current) return;

    lastAutoPastedIdRef.current = latestRemoteClipboard.id;
    const incoming = latestRemoteClipboard.content;
    if (!incoming) return;

    const prevContent = content;
    const prevMode = mode;
    const prevLang = selectedLanguage;

    const isEditorEmptyOrAuto = !content.trim() || content === lastAutoPastedTextRef.current;
    let nextContent = incoming;
    if (!isEditorEmptyOrAuto) {
      const ta = textareaRef.current;
      if (ta && typeof ta.selectionStart === "number" && typeof ta.selectionEnd === "number") {
        const before = content.slice(0, ta.selectionStart);
        const after = content.slice(ta.selectionEnd);
        const prefixSep = before && !before.endsWith("\n") ? "\n" : "";
        const suffixSep = after && !after.startsWith("\n") ? "\n" : "";
        nextContent = `${before}${prefixSep}${incoming}${suffixSep}${after}`;
      } else {
        nextContent = `${content.trimEnd()}\n${incoming}`;
      }
    }

    lastAutoPastedTextRef.current = incoming;
    setUserManuallySelectedLang(false);
    setContent(nextContent);
    setAutoPasteBanner({
      sourceDevice: latestRemoteClipboard.sourceDevice || remoteDeviceName || "Paired Device",
      charCount: incoming.length,
      prevContent,
      prevMode,
      prevLang,
    });
  }, [latestRemoteClipboard, autoClipboardSync, content, mode, selectedLanguage, remoteDeviceName]);

  const handleUndoAutoPaste = () => {
    if (!autoPasteBanner) return;
    setContent(autoPasteBanner.prevContent);
    setMode(autoPasteBanner.prevMode);
    setSelectedLanguage(autoPasteBanner.prevLang);
    setAutoPasteBanner(null);
    textareaRef.current?.focus();
  };

  // Automatic syntax detection while typing or pasting
  useEffect(() => {
    if (userManuallySelectedLang) return;

    const detected = detectSyntax(content);
    if (detected) {
      setAutoDetected(detected);
      setSelectedLanguage(detected);
      if (mode === "text") {
        setMode("code");
      }
    } else {
      setAutoDetected(null);
    }
  }, [content, mode, userManuallySelectedLang]);

  const handleSave = async () => {
    if (!content.trim() || createMessage.isPending) return;

    try {
      const langToSave = mode === "code" ? selectedLanguage : "plaintext";
      const langName = LANGUAGES.find((l) => l.id === langToSave)?.name || "Code";
      const finalTitle =
        title.trim() ||
        (mode === "code"
          ? `${langName} snippet`
          : content.trim().split("\n")[0].slice(0, 40) || "Quick note");

      const created = await createMessage.mutateAsync({
        data: {
          title: finalTitle,
          content: content.trim(),
          language: langToSave,
          folderId: selectedFolderId || undefined,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["/api/text-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });

      setRecentSaved((prev) => [
        { id: created.id, title: finalTitle, language: langToSave },
        ...prev.slice(0, 4),
      ]);

      // Save and stay ready in editor for the next note
      setContent("");
      setTitle("");
      setUserManuallySelectedLang(false);
      setAutoDetected(null);

      toast({
        title: "Saved to Vault",
        description: `"${finalTitle}" added. Ready for your next entry.`,
      });

      textareaRef.current?.focus();
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: "Could not store entry in your vault.",
      });
    }
  };

  // Tab indentation + Cmd/Ctrl+Enter quick save
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newContent = content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    setSelectedLanguage(lang);
    setUserManuallySelectedLang(true);
    setAutoDetected(null);
    if (lang !== "plaintext" && mode === "text") {
      setMode("code");
    } else if (lang === "plaintext" && mode === "code") {
      setMode("text");
    }
  };

  const switchMode = (nextMode: "text" | "code") => {
    if (nextMode === mode) return;
    setMode(nextMode);
    if (nextMode === "code") {
      if (selectedLanguage === "plaintext") {
        setSelectedLanguage("javascript");
      }
    } else {
      setSelectedLanguage("plaintext");
      setAutoDetected(null);
      setUserManuallySelectedLang(false);
    }
    textareaRef.current?.focus();
  };

  const handleBeamToPeer = () => {
    if (!content.trim()) return;
    sendClipboardText(content.trim());
    toast({
      title: "Sent to peer",
      description: `Beamed directly to ${remoteDeviceName || "connected device"}.`,
    });
  };

  const handleCopy = async () => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast({ title: "Copied to clipboard" });
  };

  const linesCount = content ? content.split("\n").length : 0;
  const wordsCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const charsCount = content.length;

  const detectedLangLabel = autoDetected
    ? LANGUAGES.find((l) => l.id === autoDetected)?.name || autoDetected
    : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl space-y-6">
        {/* Clean Minimal Studio Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Add Entry
            </h1>
            <p className="text-xs text-muted-foreground">
              Write notes or paste code — syntax is detected automatically and dissolves in 3 days.
            </p>
          </div>

          {/* Simple Segmented Mode Toggle (Text / Code) + Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center p-1 rounded-lg bg-secondary/70 border border-border/60">
              <button
                type="button"
                onClick={() => switchMode("text")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                  mode === "text"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode("code")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                  mode === "code"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-primary" />
                <span>Code</span>
              </button>
            </div>
          </div>
        </header>

        {/* Distraction-Free Document Canvas */}
        <div className="rounded-2xl bg-card border border-border/80 overflow-hidden flex flex-col">
          {/* Top Document Metadata Strip */}
          <div className="px-4 sm:px-6 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                mode === "code"
                  ? "Snippet title (e.g. auth_middleware.ts)"
                  : "Note title (optional)..."
              }
              className="flex-1 bg-transparent text-lg sm:text-xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none min-w-0"
            />

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {detectedLangLabel && (
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                  Detected: {detectedLangLabel}
                </span>
              )}

              <select
                value={selectedLanguage}
                onChange={handleLanguageChange}
                aria-label="Language syntax"
                className="h-8 rounded-lg text-xs font-medium bg-secondary/70 border border-border/70 px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name} (.{lang.ext})
                  </option>
                ))}
              </select>

              {Array.isArray(folders) && folders.length > 0 && (
                <div className="relative inline-flex items-center">
                  <Folder className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    aria-label="Destination folder"
                    className="h-8 rounded-lg text-xs font-medium bg-secondary/70 border border-border/70 pl-7 pr-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[160px]"
                  >
                    <option value="">Vault (Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Auto-Pasted Clipboard Banner with 1-click Undo */}
          {autoPasteBanner && (
            <div className="px-4 sm:px-6 py-2 border-b border-border/60 bg-primary/10 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0 text-foreground">
                <ClipboardPaste className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">
                  Auto-pasted from <strong className="font-medium">{autoPasteBanner.sourceDevice}</strong>
                </span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                  {autoPasteBanner.charCount} chars
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleUndoAutoPaste}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card border border-border/80 hover:bg-secondary text-xs font-medium text-foreground transition-colors"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoPasteBanner(null)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Seamless Writing / Code Surface */}
          <div className={mode === "code" ? "bg-muted/20" : "bg-card"}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={
                mode === "code"
                  ? "Paste or write code here — syntax is detected automatically..."
                  : isConnected && autoClipboardSync
                  ? "Start typing or paste — synced text from your paired device auto-pastes here..."
                  : "Start typing or paste text, links, or code..."
              }
              rows={15}
              className={`w-full min-h-[340px] sm:min-h-[380px] bg-transparent px-4 sm:px-6 py-5 text-foreground placeholder:text-muted-foreground/45 focus:outline-none resize-y ${
                mode === "code"
                  ? "font-mono text-xs sm:text-[13px] leading-relaxed [tab-size:2]"
                  : "font-sans text-sm sm:text-[15px] leading-relaxed"
              }`}
            />
          </div>

          {/* Integrated Footer Bar */}
          <div className="px-4 sm:px-6 py-3 border-t border-border/60 bg-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Quiet Tabular Metrics */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-mono tabular-nums flex-wrap">
              <span>{linesCount} lines</span>
              <span aria-hidden="true">·</span>
              <span>{wordsCount} words</span>
              <span aria-hidden="true">·</span>
              <span>{charsCount} chars</span>
              <span className="hidden md:inline text-border" aria-hidden="true">|</span>
              <span className="hidden md:inline font-sans text-[11px] text-muted-foreground/80">
                Ctrl+Enter to save · Tab to indent
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 justify-end">
              {(content || title) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContent("");
                    setTitle("");
                    setAutoDetected(null);
                    setUserManuallySelectedLang(false);
                    textareaRef.current?.focus();
                  }}
                  className="h-9 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-destructive"
                  title="Clear editor"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!content.trim()}
                className="h-9 px-3 rounded-lg text-xs font-medium gap-1.5 whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>

              {isConnected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBeamToPeer}
                  disabled={!content.trim()}
                  className="h-9 px-3 rounded-lg text-xs font-medium gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 whitespace-nowrap shrink-0"
                  title={`Send directly to ${remoteDeviceName || "peer"}`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Beam</span>
                </Button>
              )}

              <Button
                type="button"
                onClick={handleSave}
                disabled={createMessage.isPending || !content.trim()}
                className="h-9 px-5 rounded-lg text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{createMessage.isPending ? "Saving..." : "Save to Vault"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Quiet Session Confirmation Strip (Appears after saving so user can jump to Vault or keep writing) */}
        {recentSaved.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-medium text-foreground shrink-0">Saved this session:</span>
              <span className="truncate font-mono text-[11px]">
                {recentSaved.map((item) => item.title).join(" · ")}
              </span>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0"
            >
              <span>View in Vault</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
