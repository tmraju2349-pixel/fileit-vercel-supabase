import React, { useState, useEffect, useRef } from "react";
import {
  Code2,
  Sparkles,
  Send,
  Zap,
  Copy,
  Check,
  Trash2,
  FileText,
  ChevronDown,
  Maximize2,
  Minimize2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useP2PConnection } from "@/components/p2p-connection-context";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";
import { cn } from "@/lib/utils";

export const SUPPORTED_LANGUAGES = [
  { id: "plaintext", name: "Plain Text", ext: "txt" },
  { id: "javascript", name: "JavaScript", ext: "js" },
  { id: "typescript", name: "TypeScript", ext: "ts" },
  { id: "python", name: "Python", ext: "py" },
  { id: "json", name: "JSON", ext: "json" },
  { id: "html", name: "HTML", ext: "html" },
  { id: "css", name: "CSS", ext: "css" },
  { id: "sql", name: "SQL", ext: "sql" },
  { id: "markdown", name: "Markdown", ext: "md" },
  { id: "bash", name: "Shell / Bash", ext: "sh" },
  { id: "rust", name: "Rust", ext: "rs" },
  { id: "go", name: "Go", ext: "go" },
  { id: "cpp", name: "C++", ext: "cpp" },
  { id: "java", name: "Java", ext: "java" },
];

export function detectLanguage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "plaintext";

  // JSON detection
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Near JSON or JS object
    }
  }

  // HTML / XML
  if (
    /<!doctype html>/i.test(trimmed) ||
    /<html/i.test(trimmed) ||
    /(<[a-z][\s\S]*>[\s\S]*<\/[a-z]>)/i.test(trimmed) ||
    /<div|<span|<p|<script|<style|<svg/i.test(trimmed)
  ) {
    return "html";
  }

  // SQL
  if (
    /\b(SELECT\s+[\s\S]+\s+FROM|INSERT\s+INTO|UPDATE\s+[\s\S]+\s+SET|CREATE\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM)\b/i.test(
      trimmed
    )
  ) {
    return "sql";
  }

  // Python
  if (
    /\b(def\s+\w+\(.*\):|class\s+\w+(\(.*\))?:|import\s+\w+|from\s+\w+\s+import|elif\s+|if\s+__name__\s*==\s*['"]__main__['"])/.test(
      trimmed
    )
  ) {
    return "python";
  }

  // Shell / Bash
  if (
    trimmed.startsWith("#!/bin/bash") ||
    trimmed.startsWith("#!/bin/sh") ||
    /\b(sudo\s+|npm\s+run|git\s+(commit|push|pull|status)|docker\s+run|chmod\s+\+x)\b/.test(
      trimmed
    )
  ) {
    return "bash";
  }

  // Rust
  if (/\b(fn\s+main\(\)|pub\s+fn|let\s+mut|match\s+\w+|impl\s+\w+)/.test(trimmed)) {
    return "rust";
  }

  // Go
  if (/\b(package\s+main|func\s+main\(\)|import\s+\(|fmt\.Print)/.test(trimmed)) {
    return "go";
  }

  // TypeScript / JavaScript
  if (
    /\b(const\s+\w+\s*=|let\s+\w+\s*=|function\s+\w+\(|import\s+.*\s+from\s+['"]|export\s+(default|const)|console\.log\(|=>\s*\{?)/.test(
      trimmed
    )
  ) {
    if (/\b(interface\s+\w+|type\s+\w+\s*=|:\s*(string|number|boolean|any)[\s;,\)])/.test(trimmed)) {
      return "typescript";
    }
    return "javascript";
  }

  // CSS
  if (
    /^[.#a-zA-Z0-9_\-\s,:]+\s*\{\s*[\s\S]*:\s*[\s\S]*;\s*\}$/m.test(trimmed) ||
    /\b(@media|@keyframes|display:\s*flex|margin:\s*0)/.test(trimmed)
  ) {
    return "css";
  }

  // Markdown
  if (
    /^#{1,6}\s+/m.test(trimmed) ||
    /```[\s\S]*```/.test(trimmed) ||
    /^\s*[\*\-]\s+\[[\sx]\]/m.test(trimmed)
  ) {
    return "markdown";
  }

  return "plaintext";
}

interface QuickComposerProps {
  onSaveSnippet: (snippet: {
    title: string;
    content: string;
    language: string;
  }) => Promise<void>;
  isSaving?: boolean;
}

export function QuickComposer({ onSaveSnippet, isSaving = false }: QuickComposerProps) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [manualLang, setManualLang] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { p2pState, sendClipboardText } = useP2PConnection();
  const { setIsIslandExpanded, setIslandTab } = useDynamicBubble();

  // Auto-detect language when content changes and user hasn't manually overridden
  const detectedLang = detectLanguage(content);
  const currentLang = manualLang || detectedLang;
  const currentLangMeta =
    SUPPORTED_LANGUAGES.find((l) => l.id === currentLang) || SUPPORTED_LANGUAGES[0];

  const isCode = currentLang !== "plaintext";

  // Handle Save
  const handleSave = async () => {
    if (!content.trim()) {
      toast({
        title: "Empty snippet",
        description: "Please enter text or code before saving.",
        variant: "destructive",
      });
      return;
    }

    const defaultTitle =
      title.trim() ||
      `${currentLangMeta.name} snippet · ${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

    try {
      await onSaveSnippet({
        title: defaultTitle,
        content: content.trim(),
        language: currentLang,
      });

      setContent("");
      setTitle("");
      setManualLang(null);
      setIsExpanded(false);

      toast({
        title: "Snippet saved to workspace",
        description: `Saved as ${currentLangMeta.name}`,
      });
    } catch {
      toast({
        title: "Failed to save snippet",
        description: "An error occurred while saving.",
        variant: "destructive",
      });
    }
  };

  // Handle Beam
  const handleBeam = () => {
    if (!content.trim()) {
      toast({
        title: "Empty snippet",
        description: "Please enter some text to beam.",
        variant: "destructive",
      });
      return;
    }

    if (p2pState === "connected") {
      sendClipboardText(content);
      toast({
        title: "Snippet beamed!",
        description: "Sent via direct P2P link to your connected device.",
      });
    } else {
      // Trigger dynamic island with connectivity tab
      setIslandTab("connectivity");
      setIsIslandExpanded(true);
      toast({
        title: "Ready to beam",
        description: "Connect to a peer device in the Island or QR scanner to transfer instantly.",
      });
    }
  };

  // Handle Copy
  const handleCopy = async () => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  // Handle File Load
  const handleFileDrop = (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Files over 5MB should be dropped directly into the Files pane.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setContent(text);
        if (!title) {
          setTitle(file.name);
        }
        setIsExpanded(true);
        // Detect language by extension if applicable
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const match = SUPPORTED_LANGUAGES.find((l) => l.ext === ext);
        if (match) {
          setManualLang(match.id);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full relative group">
      {/* Ambient glowing border ring */}
      <div className="relative rounded-2xl border border-border/80 bg-card/90 shadow-sm backdrop-blur-md transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 hover:border-border">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4" />
            </div>

            {/* Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Snippet or note title (optional)..."
              className="bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/60 border-none outline-none focus:ring-0 w-full max-w-sm truncate"
            />
          </div>

          {/* Language Selector & Auto-Detect Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 transition-colors"
                title="Change language syntax"
              >
                {!manualLang && content.trim() && (
                  <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" />
                )}
                <span>{currentLangMeta.name}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showLangMenu && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 max-h-60 overflow-y-auto rounded-xl bg-popover/95 backdrop-blur-md border border-border shadow-lg p-1 z-50 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setShowLangMenu(false)}
                >
                  <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Syntax Highlighting
                  </div>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => {
                        setManualLang(lang.id);
                        setShowLangMenu(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors",
                        currentLang === lang.id
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "hover:bg-accent text-foreground"
                      )}
                    >
                      <span>{lang.name}</span>
                      <span className="text-[10px] opacity-70">.{lang.ext}</span>
                    </button>
                  ))}
                  {manualLang && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualLang(null);
                        setShowLangMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 mt-1 border-t border-border/50 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      <span>Reset to Auto-detect</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Toggle Fullscreen / Expand */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              title={isExpanded ? "Collapse editor" : "Expand editor"}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Text / Code Editor Area */}
        <div className="relative p-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder={
              isCode
                ? "// Paste or write code here... Auto-detects syntax. (Ctrl+Enter to save)"
                : "Type a quick note, paste text or clipboard here... (Ctrl+Enter to save)"
            }
            rows={isExpanded ? 12 : content.includes("\n") ? 5 : 2}
            className={cn(
              "w-full bg-transparent resize-none border-none outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60 transition-all leading-relaxed",
              isCode
                ? "font-mono text-xs md:text-sm selection:bg-emerald-500/20"
                : "text-sm selection:bg-primary/20"
            )}
          />
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-secondary/20 rounded-b-2xl flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">
              {content.length > 0 ? `${content.length} chars` : "Quick Composer"}
            </span>
            {content.includes("\n") && (
              <>
                <span>·</span>
                <span className="font-mono tabular-nums">{content.split("\n").length} lines</span>
              </>
            )}
            {p2pState === "connected" && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Peer Link Ready
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.js,.ts,.py,.json,.html,.css,.sql,.md,.sh,.c,.cpp,.rs,.go,.java"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileDrop(f);
                e.target.value = "";
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              title="Load text or code from local file"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              <span>Import</span>
            </Button>

            {content.trim() && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  title="Copy snippet"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContent("");
                    setTitle("");
                    setManualLang(null);
                  }}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  title="Clear"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBeam}
              className="h-8 px-3 text-xs border-border/80 hover:bg-secondary font-medium"
              title="Beam snippet via P2P connection"
            >
              <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
              <span>Beam</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
              className="h-8 px-3.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              <span>{isSaving ? "Saving..." : "Save Snippet"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
