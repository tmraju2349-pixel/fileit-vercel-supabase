import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  FileText,
  Music,
  Video as VideoIcon,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Layers,
  Sparkles,
  ExternalLink,
  Printer,
  Moon,
  Sun,
  Keyboard,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Check,
  Info,
  Columns,
  Search,
  SlidersHorizontal,
  ArrowLeftRight,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { inspectFileType } from "@/lib/file-type-helpers";
import { formatBytes } from "@/lib/utils";
import { useDynamicBubble, MinimizedFile } from "@/components/dynamic-bubble-context";
import { ExportShareModal } from "@/components/export-share-modal";
import { useListFiles } from "@workspace/api-client-react";

interface FullscreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  mimeType?: string;
  size?: number;
  fileSize?: number;
  url: string;
  downloadUrl?: string;
  children?: React.ReactNode;
}

export function FullscreenPreviewModal({
  isOpen,
  onClose,
  fileName,
  mimeType = "",
  size,
  fileSize,
  url,
  downloadUrl,
  children,
}: FullscreenPreviewModalProps) {
  const { toast } = useToast();
  const { addMinimizedFile, splitScreenFile, setSplitScreenFile, addRecentFile, setActivePreviewFile, recentFiles } = useDynamicBubble();
  const { data: vaultFiles } = useListFiles();
  const [showControls, setShowControls] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [customZoom, setCustomZoom] = useState(100);
  const [isExportShareOpen, setIsExportShareOpen] = useState(false);

  // Adjustable Dual-Pane Split Screen States
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage: 20 to 80
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isSplitPickerOpen, setIsSplitPickerOpen] = useState(false);
  const [splitSearchQuery, setSplitSearchQuery] = useState("");
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const effectiveSize = size ?? fileSize;
  const effectiveDownloadUrl = downloadUrl ?? url;

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const meta = inspectFileType(fileName, mimeType);

  useEffect(() => {
    if (isOpen && fileName) {
      const minType = fileName.endsWith(".pdf")
        ? "pdf"
        : fileName.match(/\.(docx|doc)$/)
        ? "docx"
        : fileName.match(/\.(xlsx|xls|csv)$/)
        ? "xlsx"
        : meta.category === "image"
        ? "image"
        : meta.category === "code" || meta.category === "text"
        ? "text"
        : "other";

      const payload = {
        id: fileName + "_" + (size || 0),
        name: fileName,
        type: minType,
        url,
        size,
      };
      addRecentFile(payload);
      setActivePreviewFile(payload);
    }
  }, [isOpen, fileName, url, size]);

  const handleClose = useCallback(() => {
    setActivePreviewFile(null);
    onClose();
  }, [onClose, setActivePreviewFile]);

  // Mouse / Touch drag listener for adjustable split divider
  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const rawPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(20, Math.min(80, Math.round(rawPercent)));
      setSplitRatio(clamped);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!splitContainerRef.current || !e.touches[0]) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const rawPercent = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(20, Math.min(80, Math.round(rawPercent)));
      setSplitRatio(clamped);
    };

    const handleDragEnd = () => setIsDraggingSplit(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDraggingSplit]);

  // Auto-hide controls after inactivity for true immersion
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowKeyboardHelp(false);
    }, 4500);
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input inside preview
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "?" || e.key === "/") {
        e.preventDefault();
        setShowKeyboardHelp((prev) => !prev);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setIsNightMode((prev) => !prev);
      } else if (e.key === "0") {
        e.preventDefault();
        setCustomZoom(100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return;
    }

    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isOpen, resetHideTimer]);

  if (!isOpen) return null;

  const handleShare = () => {
    setIsExportShareOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // Dynamic Theme Aura Glow Color based on file category
  const auraGlowColor =
    meta.category === "image"
      ? "from-cyan-500/10 via-blue-500/5"
      : meta.category === "video" || meta.category === "audio"
      ? "from-purple-500/10 via-pink-500/5"
      : meta.category === "sheet"
      ? "from-emerald-500/10 via-teal-500/5"
      : meta.category === "document" && (fileName.toLowerCase().endsWith(".pdf") || mimeType === "application/pdf")
      ? "from-red-500/10 via-orange-500/5"
      : meta.category === "presentation"
      ? "from-amber-500/10 via-orange-500/5"
      : "from-indigo-500/10 via-primary/5";

  return (
    <div
      className={`fixed inset-0 z-[9999] w-[100dvw] h-[100dvh] bg-background/98 backdrop-blur-3xl flex flex-col select-none overflow-hidden touch-manipulation transition-colors duration-300 ${
        isNightMode ? "dark bg-black/95 text-white" : ""
      }`}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={(e) => {
        // Tap background canvas to toggle HUD controls
        if ((e.target as HTMLElement).tagName === "MAIN" || (e.target as HTMLElement).id === "fullscreen-canvas") {
          setShowControls((prev) => !prev);
        }
      }}
    >
      {/* ── Ambient Radial Glow Light in Background ── */}
      <div
        className={`absolute inset-0 bg-gradient-radial ${auraGlowColor} to-transparent pointer-events-none opacity-80 blur-3xl`}
      />

      {/* ── Top Floating Glass Island Titlebar ── */}
      <header
        className={`fixed top-3 sm:top-5 inset-x-3 sm:inset-x-8 z-50 transition-all duration-300 transform ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6 pointer-events-none"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-6xl mx-auto bg-card/90 dark:bg-card/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2.5">
          {/* Left: Document details */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/15 text-primary border border-primary/25 flex items-center justify-center shrink-0 shadow-inner">
              {meta.category === "image" ? (
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "video" ? (
                <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "audio" ? (
                <Music className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "sheet" ? (
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "code" || meta.category === "text" ? (
                <FileCode className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "archive" ? (
                <FileArchive className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs sm:text-sm font-black text-foreground truncate max-w-[130px] sm:max-w-md tracking-tight"
                  title={fileName}
                >
                  {fileName}
                </span>
                <span className="px-1.5 py-0.2 rounded-md text-[9px] sm:text-[10px] font-mono font-bold bg-primary/15 text-primary border border-primary/20 shrink-0 uppercase">
                  {meta.extension || "FILE"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{size ? `${formatBytes(size)} • ` : ""}Studio Theater Mode</span>
              </p>
            </div>
          </div>

          {/* Right: Quick actions and Exit Fullscreen Button */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Keyboard Shortcuts Hint */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowKeyboardHelp((h) => !h)}
              className="h-8 sm:h-9 w-8 sm:w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground hidden sm:flex"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>

            {/* Share / Copy Link Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold gap-1.5 shadow-xs border-border"
              title="Share or Copy Link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{copiedLink ? "Copied" : "Share"}</span>
            </Button>


            {/* Split Screen View */}
            <Button
              size="sm"
              variant={splitScreenFile ? "default" : "outline"}
              onClick={() => {
                setIsSplitPickerOpen(true);
              }}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold gap-1.5 shadow-xs border-border"
              title={splitScreenFile ? "Adjust or Switch Split View" : "Open Split-Screen Comparison"}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{splitScreenFile ? "Split Active" : "Split Screen"}</span>
            </Button>

            {/* Download Button */}
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold gap-1.5 shadow-xs border-border"
              title="Download original file"
            >
              <a href={url} download={fileName}>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            </Button>

            {/* Main Exit Fullscreen Button */}
            <Button
              size="sm"
              onClick={handleClose}
              className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl text-xs font-black shadow-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:scale-105 active:scale-95 transition-all gap-1.5"
              title="Exit Fullscreen (ESC)"
            >
              <X className="w-4 h-4" />
              <span>Exit</span>
              <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.2 bg-black/25 rounded text-[9px] font-mono font-normal">
                ESC
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Stage Canvas Area (Adjustable Side-by-Side Dual Pane) ── */}
      <main
        id="fullscreen-canvas"
        ref={splitContainerRef}
        className="flex-1 w-full h-full overflow-hidden flex items-center justify-center p-2 sm:p-4 pt-16 sm:pt-20 pb-16 sm:pb-20 relative z-10"
      >
        <div className="w-full h-full max-w-7xl mx-auto flex flex-col md:flex-row items-stretch overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md shadow-2xl">
          {/* Primary View Pane */}
          <div
            style={{ width: splitScreenFile ? `${splitRatio}%` : "100%" }}
            className="h-full flex flex-col overflow-hidden transition-[width] duration-75 relative bg-card/60"
          >
            {splitScreenFile && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/80 bg-secondary/40 shrink-0 text-xs font-bold text-foreground">
                <span className="truncate flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">{fileName}</span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{splitRatio}%</span>
              </div>
            )}
            <div className="flex-1 w-full h-full flex items-center justify-center p-2 overflow-auto">
              {children}
            </div>
          </div>

          {/* Draggable Split Divider */}
          {splitScreenFile && (
            <div
              onMouseDown={() => setIsDraggingSplit(true)}
              onTouchStart={() => setIsDraggingSplit(true)}
              className="w-3 md:w-3.5 h-4 md:h-full cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors flex items-center justify-center shrink-0 select-none group relative z-30"
              title="Drag to resize split panes (Double click to reset 50/50)"
              onDoubleClick={() => setSplitRatio(50)}
            >
              <div className="w-1 h-8 rounded-full bg-muted-foreground/60 group-hover:bg-primary transition-colors" />
            </div>
          )}

          {/* Secondary Split Pane */}
          {splitScreenFile && (
            <div
              style={{ width: `${100 - splitRatio}%` }}
              className="h-full flex flex-col overflow-hidden transition-[width] duration-75 relative bg-card/80 border-t md:border-t-0 md:border-l border-border"
            >
              {/* Secondary Pane Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/80 bg-secondary/50 shrink-0 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                    Split View
                  </span>
                  <span className="font-bold text-foreground truncate">{splitScreenFile.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Ratio Presets */}
                  <div className="hidden sm:flex items-center gap-0.5 bg-background/60 p-0.5 rounded-lg border border-border/60">
                    <button
                      type="button"
                      onClick={() => setSplitRatio(33)}
                      className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${splitRatio === 33 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      title="1:2 Ratio (33% / 67%)"
                    >
                      1:2
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitRatio(50)}
                      className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${splitRatio === 50 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      title="1:1 Ratio (50% / 50%)"
                    >
                      1:1
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitRatio(67)}
                      className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${splitRatio === 67 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      title="2:1 Ratio (67% / 33%)"
                    >
                      2:1
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsSplitPickerOpen(true)}
                    className="h-6 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                    title="Change Document"
                  >
                    <ArrowLeftRight className="w-3 h-3 mr-1" />
                    <span>Switch</span>
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSplitScreenFile(null)}
                    className="h-6 w-6 rounded-lg text-muted-foreground hover:text-destructive"
                    title="Close Split View"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Secondary Pane Content */}
              <div className="flex-1 w-full h-full flex items-center justify-center p-2 overflow-auto">
                {splitScreenFile.url ? (
                  splitScreenFile.type === "pdf" ? (
                    <iframe
                      src={splitScreenFile.url}
                      className="w-full h-full min-h-[400px] rounded-xl border border-border"
                      title={splitScreenFile.name}
                    />
                  ) : splitScreenFile.type === "image" ? (
                    <img
                      src={splitScreenFile.url}
                      alt={splitScreenFile.name}
                      className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
                    />
                  ) : (
                    <div className="text-center space-y-3 p-6">
                      <FileText className="w-12 h-12 text-primary mx-auto" />
                      <p className="text-sm font-bold text-foreground">{splitScreenFile.name}</p>
                      {splitScreenFile.size ? (
                        <p className="text-xs font-mono text-muted-foreground">{formatBytes(splitScreenFile.size)}</p>
                      ) : null}
                      <Button asChild size="sm">
                        <a href={splitScreenFile.url} download={splitScreenFile.name}>
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Download
                        </a>
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">Split view loaded</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Split Screen File Picker Modal */}
      {isSplitPickerOpen && (
        <div
          className="fixed inset-0 z-[120000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsSplitPickerOpen(false)}
        >
          <div
            className="bg-card text-card-foreground border border-border p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <Columns className="w-4 h-4 text-primary" />
                  <span>Choose File for Split-Screen</span>
                </h3>
                <p className="text-xs text-muted-foreground">Select a file to compare side-by-side</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsSplitPickerOpen(false)} className="h-7 w-7 rounded-lg">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                value={splitSearchQuery}
                onChange={(e) => setSplitSearchQuery(e.target.value)}
                placeholder="Search vault or recent files..."
                className="pl-9 h-9 rounded-xl text-xs"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {vaultFiles && vaultFiles.length > 0 ? (
                vaultFiles
                  .filter((f) => f.originalName !== fileName && (!splitSearchQuery || f.originalName.toLowerCase().includes(splitSearchQuery.toLowerCase())))
                  .map((vf) => (
                    <div
                      key={vf.id}
                      onClick={() => {
                        const mType = vf.originalName.endsWith(".pdf") ? "pdf" : vf.originalName.match(/\.(docx|doc)$/) ? "docx" : vf.mimeType?.startsWith("image/") ? "image" : "other";
                        setSplitScreenFile({
                          id: vf.id,
                          name: vf.originalName,
                          type: mType,
                          url: `/api/files/${vf.id}/download`,
                          size: vf.size,
                        });
                        setIsSplitPickerOpen(false);
                        toast({ title: "Split View Opened", description: `Comparing against ${vf.originalName}` });
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary cursor-pointer text-xs border border-transparent hover:border-border transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate group-hover:text-primary">{vf.originalName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{formatBytes(vf.size)}</span>
                    </div>
                  ))
              ) : recentFiles.length > 0 ? (
                recentFiles
                  .filter((rf) => rf.name !== fileName && (!splitSearchQuery || rf.name.toLowerCase().includes(splitSearchQuery.toLowerCase())))
                  .map((rf) => (
                    <div
                      key={rf.id}
                      onClick={() => {
                        setSplitScreenFile(rf);
                        setIsSplitPickerOpen(false);
                        toast({ title: "Split View Opened", description: `Comparing against ${rf.name}` });
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary cursor-pointer text-xs border border-transparent hover:border-border transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate group-hover:text-primary">{rf.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">Recent</span>
                    </div>
                  ))
              ) : (
                <p className="text-center py-6 text-xs text-muted-foreground">No other files available in vault.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Floating Dock Action Toolbar ── */}
      <footer
        className={`fixed bottom-3 sm:bottom-5 inset-x-4 sm:inset-x-0 z-50 flex justify-center transition-all duration-300 transform pointer-events-none ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="pointer-events-auto bg-card/90 dark:bg-card/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl sm:rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3">
          {/* Night reading mode toggle */}
          <button
            type="button"
            onClick={() => setIsNightMode((n) => !n)}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isNightMode
                ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title="Toggle Night Theme (N)"
          >
            {isNightMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline text-[11px]">{isNightMode ? "Day Mode" : "Night Mode"}</span>
          </button>

          <div className="w-px h-4 bg-border hidden sm:block" />

          {/* Quick Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:flex items-center gap-1.5"
            title="Print Preview (Ctrl/Cmd + P)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="text-[11px]">Print</span>
          </button>

          <div className="w-px h-4 bg-border hidden sm:block" />

          {/* Direct File Link Button */}
          <button
            type="button"
            onClick={() => window.open(url, "_blank")}
            className="p-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
            title="Open in Native Browser Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Native Tab</span>
          </button>

          {/* Quick Dismiss Fullscreen */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
            title="Exit Fullscreen (ESC)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Close Theater</span>
          </button>
        </div>
      </footer>

      {/* ── Keyboard Shortcuts Guide Overlay Popover ── */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border shadow-2xl rounded-3xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-primary" />
                Fullscreen Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Exit Fullscreen</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">ESC</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Toggle Night Mode</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">N</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Play / Pause Media</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Rewind / Skip 5s</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">← / →</kbd>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setShowKeyboardHelp(false)}
              className="w-full rounded-xl font-bold text-xs"
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {/* ── Persistent Floating Mobile Quick-Exit Button (Always accessible on phones) ── */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit Fullscreen Mode"
        className={`fixed top-3 right-3 z-50 w-10 h-10 rounded-full bg-black/85 backdrop-blur-md text-white border border-white/20 shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all md:hidden ${
          showControls ? "opacity-0 pointer-events-none" : "opacity-90"
        }`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Multi-App Export & Share Modal */}
      <ExportShareModal
        isOpen={isExportShareOpen}
        onClose={() => setIsExportShareOpen(false)}
        fileName={fileName}
        fileSize={effectiveSize}
        mimeType={mimeType}
        shareUrl={url}
        downloadUrl={effectiveDownloadUrl}
        customNote={`Viewing shared file: ${fileName}`}
      />
    </div>
  );
}
