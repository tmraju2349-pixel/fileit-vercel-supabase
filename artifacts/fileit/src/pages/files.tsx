import { Layout } from "@/components/layout";
import {
  useListFiles,
  useDeleteFile,
  useMoveFile,
  useListFolders,
  useCreateFolder,
  useDeleteFolder,
  useListTextMessages,
  useCreateTextMessage,
  useDeleteTextMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { getActiveRoom, leaveActiveRoom } from "@/lib/rooms-storage";
import { FileCard, FileCardSkeleton } from "@/components/file-card";
import { FolderCard } from "@/components/folder-card";
import { FolderShareDialog } from "@/components/folder-share-dialog";
import { TextMessageCard } from "@/components/text-message-card";
import { QuickComposer } from "@/components/quick-composer";
import { useUpload } from "@/hooks/use-upload";
import { ChangeExpirationDialog } from "@/components/change-expiration-dialog";
import { GoogleDriveModal } from "@/components/google-drive-modal";
import { GlassmorphicUnlockModal } from "@/components/glassmorphic-unlock-modal";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Files, Folder, ArrowLeft, Plus, Trash2, FileCode2, Share2, Lock, Clock, Search, LayoutGrid, List, X, Cloud, Sparkles, UploadCloud, Upload, Columns2, Code2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function FilesPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [fileToMove, setFileToMove] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderPassword, setNewFolderPassword] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<string>("259200"); // Default 3 days (in seconds)
  const [newFolderDuration, setNewFolderDuration] = useState<string>("259200"); // Default 3 days (in seconds)
  const [textMessageOpen, setTextMessageOpen] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textLanguage, setTextLanguage] = useState("plaintext");
  const [textFolderId, setTextFolderId] = useState("");
  const [linkedFileId, setLinkedFileId] = useState("");
  const [folderToShare, setFolderToShare] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "documents" | "images" | "media" | "archives" | "code">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [googleDriveOpen, setGoogleDriveOpen] = useState(false);
  const [unlockedFolders, setUnlockedFolders] = useState<Record<string, boolean>>({});
  const [folderToUnlock, setFolderToUnlock] = useState<any | null>(null);

  const { stageFile, setIsIslandExpanded, setIslandTab } = useDynamicBubble();
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [draggedFilesCount, setDraggedFilesCount] = useState(1);
  const [hoveredDropZone, setHoveredDropZone] = useState<"island" | "vault" | string | null>(null);
  const dragCounterRef = useRef(0);
  const nativeFileInputRef = useRef<HTMLInputElement>(null);
  const [workspaceView, setWorkspaceView] = useState<"dual" | "files" | "code">("dual");
  const [textSearchQuery, setTextSearchQuery] = useState("");
  const [textLangFilter, setTextLangFilter] = useState("all");

  const [, setLocation] = useLocation();
  const [activeRoom, setActiveRoomState] = useState(() => getActiveRoom());

  const { data: files, isLoading } = useListFiles(
    currentFolderId ? { folderId: currentFolderId } : undefined
  );
  const { data: allFiles } = useListFiles();
  const { data: folders } = useListFolders();
  // Include all user folders (both regular and password protected)
  const safeFolders = folders || [];
  
  // Dynamic folders list: includes active validated room so users can drag-and-drop to it
  const displayFolders = useMemo(() => {
    const list = [...(safeFolders || [])];
    if (activeRoom && !list.some((f) => f.id === activeRoom.id)) {
      list.unshift({
        id: activeRoom.id,
        name: activeRoom.name,
        password: "true",
        expiresAt: activeRoom.expiresAt,
        createdAt: activeRoom.joinedAt,
        shareToken: activeRoom.token,
      });
    }
    return list;
  }, [safeFolders, activeRoom]);

  const filteredFiles = useMemo(() => {
    if (!files || !Array.isArray(files)) return [];
    return files.filter((f) => {
      if (searchQuery.trim() && !f.originalName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (typeFilter !== "all") {
        const name = f.originalName.toLowerCase();
        const mime = f.mimeType?.toLowerCase() || "";
        if (typeFilter === "images") {
          if (!mime.startsWith("image/") && ![".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "documents") {
          if (!mime.includes("pdf") && !mime.includes("document") && !mime.includes("sheet") && !mime.includes("text") && ![".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".md", ".pptx"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "media") {
          if (!mime.startsWith("video/") && !mime.startsWith("audio/") && ![".mp4", ".mov", ".webm", ".mkv", ".mp3", ".wav", ".ogg", ".m4a", ".flac"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "archives") {
          if (!mime.includes("zip") && !mime.includes("tar") && !mime.includes("compressed") && ![".zip", ".tar", ".gz", ".7z", ".rar", ".bz2"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "code") {
          if (![".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css", ".json", ".sql", ".go", ".rs", ".cpp", ".c", ".java"].some((ext) => name.endsWith(ext))) return false;
        }
      }
      return true;
    });
  }, [files, searchQuery, typeFilter]);

  const { data: textMessages } = useListTextMessages(
    currentFolderId ? { folderId: currentFolderId } : undefined,
  );

  const filteredTextMessages = useMemo(() => {
    if (!textMessages || !Array.isArray(textMessages)) return [];
    return [...textMessages]
      .filter((msg) => {
        if (textSearchQuery.trim()) {
          const q = textSearchQuery.toLowerCase();
          const matchesTitle = msg.title?.toLowerCase().includes(q);
          const matchesContent = msg.content?.toLowerCase().includes(q);
          const matchesLang = msg.language?.toLowerCase().includes(q);
          if (!matchesTitle && !matchesContent && !matchesLang) return false;
        }
        if (textLangFilter !== "all" && msg.language?.toLowerCase() !== textLangFilter.toLowerCase()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [textMessages, textSearchQuery, textLangFilter]);

  const availableTextLangs = useMemo(() => {
    if (!textMessages || !Array.isArray(textMessages)) return [];
    const set = new Set(textMessages.map((m) => m.language).filter(Boolean));
    return Array.from(set);
  }, [textMessages]);

  const { uploadFile, isUploading, progress } = useUpload();
  const moveFile = useMoveFile();
  const deleteFile = useDeleteFile();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const createTextMessage = useCreateTextMessage();
  const deleteTextMessage = useDeleteTextMessage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentFolder = folders?.find((f) => f.id === currentFolderId);

  // Check active room state periodically/on focus
  useEffect(() => {
    const checkRoom = () => setActiveRoomState(getActiveRoom());
    window.addEventListener("focus", checkRoom);
    return () => window.removeEventListener("focus", checkRoom);
  }, []);

  // Listen for drag-and-drop moves from FileCard onto FolderCard
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { fileId: string; folderId: string };
      if (detail?.fileId && detail?.folderId) {
        handleMoveToFolder(detail.fileId, detail.folderId);
      }
    };
    window.addEventListener("file-drop-to-folder", handler);
    return () => window.removeEventListener("file-drop-to-folder", handler);
  }, []);

  // Listen for external OS files dropped onto FolderCard
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        files: FileList;
        folderId: string;
        folderName?: string;
      };
      if (detail?.files && detail?.folderId) {
        toast({
          title: "Uploading to folder...",
          description: `Uploading ${detail.files.length} file(s) to "${detail.folderName || "folder"}".`,
        });
        try {
          for (let i = 0; i < detail.files.length; i++) {
            await uploadFile(detail.files[i], detail.folderId);
          }
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
          toast({
            title: "Upload Complete",
            description: `Added ${detail.files.length} file(s) to "${detail.folderName || "folder"}".`,
          });
        } catch {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: `Could not complete upload to "${detail.folderName || "folder"}".`,
          });
        }
      }
    };
    window.addEventListener("os-files-drop-to-folder", handler);
    return () => window.removeEventListener("os-files-drop-to-folder", handler);
  }, [uploadFile, queryClient, toast]);

  // Global window drag-and-drop listener to highlight drop areas
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) {
        setIsWindowDragging(true);
        const count = e.dataTransfer.items?.length || 1;
        setDraggedFilesCount(count);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsWindowDragging(false);
        setHoveredDropZone(null);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) {
        if (!isWindowDragging) setIsWindowDragging(true);
        const count = e.dataTransfer.items?.length || 1;
        setDraggedFilesCount(count);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsWindowDragging(false);
      setHoveredDropZone(null);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [isWindowDragging]);

  const processBatchUpload = async (filesList: File[], targetFolderId?: string) => {
    if (!filesList || filesList.length === 0) return;
    toast({
      title: targetFolderId ? "Uploading to Folder..." : "Uploading to Vault...",
      description: `Uploading ${filesList.length} file(s)...`,
    });
    try {
      let expiresAt: string | undefined = undefined;
      if (selectedDuration === "folder-default") {
        expiresAt = undefined;
      } else if (selectedDuration !== "forever") {
        expiresAt = new Date(Date.now() + parseInt(selectedDuration) * 1000).toISOString();
      }

      for (const file of filesList) {
        await uploadFile(file, targetFolderId, expiresAt);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Upload Succeeded",
        description: `Successfully stored ${filesList.length} file(s).`,
      });
    } catch {
      toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload files." });
    }
  };

  // Sync selectedDuration when entering or leaving a folder
  useEffect(() => {
    if (currentFolderId) {
      setSelectedDuration("folder-default");
    } else {
      setSelectedDuration("259200");
    }
  }, [currentFolderId]);

  const handleMoveToFolder = async (fileId: string, targetFolderId: string) => {
    try {
      await moveFile.mutateAsync({
        id: fileId,
        data: { folderId: targetFolderId === "root" ? null : targetFolderId },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({ title: "File moved successfully" });
    } catch {
      toast({ variant: "destructive", title: "Failed to move file" });
    }
  };

  const handleFileSelect = async (file: File) => {
    let expiresAt: string | undefined = undefined;
    if (selectedDuration === "folder-default") {
      expiresAt = undefined; // inherit folder timer on backend
    } else if (selectedDuration !== "forever") {
      expiresAt = new Date(Date.now() + parseInt(selectedDuration) * 1000).toISOString();
    }
    await uploadFile(file, currentFolderId || undefined, expiresAt);
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
  };

  const handleMove = async (targetFolderId: string) => {
    if (!fileToMove) return;
    await handleMoveToFolder(fileToMove, targetFolderId);
    setFileToMove(null);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    try {
      await deleteFile.mutateAsync({ id: fileToDelete });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files/stats"] });
      toast({ title: "File deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete" });
    } finally {
      setFileToDelete(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      let expiresAt: string | undefined = undefined;
      if (newFolderDuration !== "forever") {
        expiresAt = new Date(Date.now() + parseInt(newFolderDuration) * 1000).toISOString();
      }
      await createFolder.mutateAsync({ data: { 
        name: newFolderName.trim(),
        expiresAt,
        password: newFolderPassword.trim() || undefined,
      } });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({ title: newFolderPassword.trim() ? "Locked folder created" : "Folder created" });
      setNewFolderName("");
      setNewFolderPassword("");
      setNewFolderDuration("259200");
      setCreateFolderOpen(false);
    } catch {
      toast({ variant: "destructive", title: "Failed to create folder" });
    }
  };

  const resetTextMessageForm = () => {
    setTextTitle("");
    setTextContent("");
    setTextLanguage("plaintext");
    setTextFolderId(currentFolderId || "");
    setLinkedFileId("");
  };

  const openTextMessageDialog = () => {
    resetTextMessageForm();
    setTextMessageOpen(true);
  };

  const handleCreateTextMessage = async () => {
    if (!textContent) return;
    try {
      await createTextMessage.mutateAsync({
        data: {
          content: textContent,
          title: textTitle.trim() || undefined,
          language: textLanguage,
          fileId: linkedFileId || null,
          folderId: textFolderId || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/text-messages"] });
      toast({ title: "Text message saved" });
      setTextMessageOpen(false);
      resetTextMessageForm();
    } catch {
      toast({ variant: "destructive", title: "Failed to save text message" });
    }
  };

  const handleDeleteTextMessage = async (id: string) => {
    try {
      await deleteTextMessage.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/text-messages"] });
      toast({ title: "Text message deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete text message" });
    }
  };

  const handleQuickSaveSnippet = async (snippet: {
    title: string;
    content: string;
    language: string;
  }) => {
    try {
      await createTextMessage.mutateAsync({
        data: {
          content: snippet.content,
          title: snippet.title,
          language: snippet.language,
          folderId: currentFolderId || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/text-messages"] });
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to save snippet",
      });
      throw new Error("Failed to save snippet");
    }
  };

  const handleNativeFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = Array.from(e.target.files || []);
    if (filesList.length > 0) {
      processBatchUpload(filesList, currentFolderId || undefined);
    }
    e.target.value = "";
  };

  const handleDeleteFolderConfirm = async () => {
    if (!folderToDelete) return;
    try {
      await deleteFolder.mutateAsync({ id: folderToDelete });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Folder deleted" });
      if (folderToDelete === currentFolderId) setCurrentFolderId(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to delete folder" });
    } finally {
      setFolderToDelete(null);
    }
  };

  return (
    <Layout>
      {/* Ambient Multi-Target Dropzone Overlay (Activated when dragging files into window) */}
      <AnimatePresence>
        {isWindowDragging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-background/90 dark:bg-background/95 backdrop-blur-2xl p-4 sm:p-8 flex flex-col justify-between overflow-y-auto pointer-events-auto select-none border-4 border-dashed border-emerald-500/70 shadow-[inset_0_0_120px_rgba(16,185,129,0.2)] ring-8 ring-emerald-500/15"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setIsWindowDragging(false);
              setHoveredDropZone(null);
              const files = Array.from(e.dataTransfer.files);
              if (files.length > 0) {
                processBatchUpload(files, currentFolderId || undefined);
              }
            }}
          >
            {/* Overlay Top Bar */}
            <div className="flex items-center justify-between border-b border-border/80 pb-3 max-w-5xl mx-auto w-full gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
                <h3 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  Fileit Precision Dropzone
                </h3>
                {/* Live file counter badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-semibold shadow-xs">
                  <UploadCloud className="w-3.5 h-3.5 animate-bounce text-emerald-400" />
                  <span>
                    {draggedFilesCount > 1
                      ? `${draggedFilesCount} Files Detected`
                      : "File Detected"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground hidden md:inline">
                  Release anywhere for Vault or hover a target below
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsWindowDragging(false);
                    setHoveredDropZone(null);
                  }}
                  className="px-3 py-1 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
                >
                  Dismiss (ESC)
                </button>
              </div>
            </div>

            {/* Target 1: Fileit Dynamic Island Target (Top) */}
            <div className="max-w-3xl mx-auto w-full pt-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoveredDropZone("island");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (hoveredDropZone === "island") setHoveredDropZone(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsWindowDragging(false);
                  setHoveredDropZone(null);
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    files.forEach((f) => stageFile(f));
                    setIsIslandExpanded(true);
                    setIslandTab("shelf");
                    toast({
                      title: "Staged in Fileit Island",
                      description: `${files.length} file(s) loaded into top island shelf for instant beam.`,
                    });
                  }
                }}
                className={cn(
                  "p-5 rounded-3xl border-2 border-dashed transition-all flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer",
                  hoveredDropZone === "island"
                    ? "border-violet-500 bg-violet-500/20 shadow-2xl shadow-violet-500/20 scale-[1.02] ring-4 ring-violet-500/20"
                    : "border-violet-500/40 bg-violet-500/5 hover:border-violet-500 hover:bg-violet-500/10"
                )}
              >
                <div className="flex items-center gap-3.5 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-foreground">
                      Drop into Fileit Dynamic Island
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Stage file into Island shelf — immediate P2P direct beam &amp; multi-tasking stash
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-violet-400 bg-violet-500/20 px-3 py-1.5 rounded-xl shrink-0">
                  ISLAND SHELF
                </span>
              </div>
            </div>

            {/* Target 2: Central Vault Drop Target (Center) */}
            <div className="max-w-3xl mx-auto w-full py-4 flex-1 flex flex-col justify-center">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoveredDropZone("vault");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (hoveredDropZone === "vault") setHoveredDropZone(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsWindowDragging(false);
                  setHoveredDropZone(null);
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    processBatchUpload(files, currentFolderId || undefined);
                  }
                }}
                className={cn(
                  "p-8 sm:p-12 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[200px]",
                  hoveredDropZone === "vault"
                    ? "border-primary bg-primary/15 shadow-2xl shadow-primary/20 scale-[1.02] ring-4 ring-primary/20"
                    : "border-border/80 bg-card/60 hover:border-primary/60 hover:bg-card/90"
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  Drop to Upload into Vault: {currentFolder ? currentFolder.name : "My Files"}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Files upload directly into active directory with auto-dissolve set to{" "}
                  <span className="font-semibold text-foreground">
                    {selectedDuration === "folder-default" ? "Folder Default" : selectedDuration === "forever" ? "Keep Forever" : `${parseInt(selectedDuration)/86400} Days`}
                  </span>
                </p>
              </div>
            </div>

            {/* Target 3: Specific Folders Targets (Bottom) */}
            {displayFolders && displayFolders.length > 0 && (
              <div className="max-w-5xl mx-auto w-full pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-2 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    <span>Or Drop directly into a folder to organize instantly:</span>
                  </span>
                  <span className="font-mono text-[11px]">{displayFolders.length} Folders</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto p-1">
                  {displayFolders.map((f) => (
                    <div
                      key={f.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHoveredDropZone(f.id);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (hoveredDropZone === f.id) setHoveredDropZone(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsWindowDragging(false);
                        setHoveredDropZone(null);
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) {
                          processBatchUpload(files, f.id);
                        }
                      }}
                      className={cn(
                        "p-3 rounded-2xl border-2 border-dashed transition-all flex items-center gap-2.5 cursor-pointer text-left",
                        hoveredDropZone === f.id
                          ? "border-emerald-500 bg-emerald-500/25 shadow-lg shadow-emerald-500/20 scale-105 ring-2 ring-emerald-500/30"
                          : "border-border/80 bg-card/80 hover:border-emerald-500/60 hover:bg-emerald-500/5"
                      )}
                    >
                      <Folder className={cn("w-5 h-5 shrink-0", hoveredDropZone === f.id ? "text-emerald-400" : "text-amber-500")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {hoveredDropZone === f.id ? "Release to upload" : "Drop to store"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Workspace Toolbar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            {currentFolderId ? (
              <button
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Payloads</span>
              </button>
            ) : null}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {currentFolderId ? (
                  <Folder className="w-5 h-5 text-amber-500" />
                ) : (
                  <Files className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {currentFolder ? currentFolder.name : "Unified Workspace"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Vault, source files, and live text/code with synchronized timestamps
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Hidden native file input */}
            <input
              ref={nativeFileInputRef}
              type="file"
              multiple
              onChange={handleNativeFilesUpload}
              className="hidden"
            />

            <Button
              size="sm"
              onClick={() => nativeFileInputRef.current?.click()}
              className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs"
              title="Upload files from disk"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Files</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setGoogleDriveOpen(true)}
              className="h-8 gap-1.5 text-xs border-border/80 hover:bg-secondary"
            >
              <Cloud className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Drive</span>
            </Button>

            {currentFolder && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFolderToShare(currentFolder.id)}
                className="h-8 gap-1.5 text-xs border-border/80 hover:bg-secondary"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </Button>
            )}

            {!currentFolderId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateFolderOpen(true)}
                className="h-8 gap-1.5 text-xs border-border/80 hover:bg-secondary"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Folder</span>
              </Button>
            )}

            {/* Workspace View Mode Split Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-secondary/60 border border-border/60">
              <button
                type="button"
                onClick={() => setWorkspaceView("dual")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  workspaceView === "dual"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Dual Pane (Files alongside Code/Text)"
              >
                <Columns2 className="w-3.5 h-3.5 inline mr-1" />
                <span className="hidden md:inline">Dual</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceView("files")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  workspaceView === "files"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Files only"
              >
                <Files className="w-3.5 h-3.5 inline mr-1" />
                <span className="hidden md:inline">Files</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceView("code")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  workspaceView === "code"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Code & Text only"
              >
                <FileCode2 className="w-3.5 h-3.5 inline mr-1" />
                <span className="hidden md:inline">Code/Text</span>
              </button>
            </div>
          </div>
        </div>

        {/* Auto-Dissolve Timer Selector (Compact Hairline Strip) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md border border-border/80 p-2.5 rounded-2xl shadow-xs">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 px-2 self-start sm:self-center">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <span>Auto-Dissolve {currentFolderId ? "override" : "timer"}:</span>
          </span>
          <div className="grid grid-cols-3 sm:flex items-center gap-1 w-full sm:w-auto">
            {[
              ...(currentFolderId ? [{ label: "Inherit", fullLabel: "Folder Timer", value: "folder-default" }] : []),
              { label: "1h", fullLabel: "1 Hour", value: "3600" },
              { label: "12h", fullLabel: "12 Hours", value: "43200" },
              { label: "1d", fullLabel: "1 Day", value: "86400" },
              { label: "3d", fullLabel: "3 Days", value: "259200" },
              { label: "1w", fullLabel: "1 Week", value: "604800" },
              { label: "Forever", fullLabel: "Keep Forever", value: "forever" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`h-7 sm:h-8 text-xs font-medium rounded-lg px-2 sm:px-2.5 transition-all text-center ${
                  selectedDuration === opt.value
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
                onClick={() => setSelectedDuration(opt.value)}
                title={opt.fullLabel}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Top Quick Composer for Code & Text with Syntax Auto-Detection */}
        <QuickComposer onSaveSnippet={handleQuickSaveSnippet} />

        {/* Dual-Column Synchronized Workspace Grid */}
        <div
          className={cn(
            "grid gap-6 items-start",
            workspaceView === "dual" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"
          )}
        >
          {/* Left Column: Files & Folders Pane */}
          {(workspaceView === "dual" || workspaceView === "files") && (
            <div
              className={cn(
                "space-y-6",
                workspaceView === "dual" ? "lg:col-span-7" : "w-full"
              )}
            >
              {/* Folders & Rooms (only at root) */}
              {!currentFolderId && displayFolders && displayFolders.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                      <span>Folders &amp; Rooms</span>
                    </h2>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {displayFolders.length} lockers
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {displayFolders.map((folder, i) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        onClick={() => {
                          if (activeRoom && folder.id === activeRoom.id) {
                            setLocation(`/rooms/${folder.id}`);
                          } else if (folder.password && !unlockedFolders[folder.id]) {
                            setFolderToUnlock(folder);
                          } else {
                            setCurrentFolderId(folder.id);
                          }
                        }}
                        onDelete={() => {
                          if (activeRoom && folder.id === activeRoom.id) {
                            leaveActiveRoom();
                            setActiveRoomState(null);
                            toast({ title: "Session Closed", description: "Left private room." });
                          } else {
                            setFolderToDelete(folder.id);
                          }
                        }}
                        onShare={() => {
                          if (activeRoom && folder.id === activeRoom.id) {
                            setLocation(`/rooms/${folder.id}`);
                          } else {
                            setFolderToShare(folder.id);
                          }
                        }}
                        fileCount={folder.fileCount}
                        index={i}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Files Section with Search, Category Filter, and View Mode Toggle */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Files className="w-4 h-4 text-primary" />
                      <span>{currentFolderId ? `Files in "${currentFolder?.name}"` : "Files Vault"}</span>
                    </h2>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      ({filteredFiles.length}
                      {filteredFiles.length !== (files?.length ?? 0)
                        ? ` of ${files?.length ?? 0}`
                        : ""}
                      )
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Switcher */}
                    <div className="flex items-center p-0.5 rounded-lg bg-secondary/60 border border-border/60">
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-md transition-all ${
                          viewMode === "list"
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="List view"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={`p-1.5 rounded-md transition-all ${
                          viewMode === "grid"
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Grid view"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Search & Category Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-8 h-9 text-xs bg-card/60 border-border/80 rounded-xl"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category Segmented Control */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {[
                      { id: "all", label: "All" },
                      { id: "documents", label: "Docs" },
                      { id: "images", label: "Images" },
                      { id: "media", label: "Media" },
                      { id: "archives", label: "Archives" },
                      { id: "code", label: "Code" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTypeFilter(tab.id as typeof typeFilter)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                          typeFilter === tab.id
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary/70 border border-border/40"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <FileCardSkeleton key={i} />
                    ))}
                  </div>
                ) : !Array.isArray(files) || files.length === 0 ? (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-12 text-center gap-3 bg-card/30 rounded-2xl border border-dashed border-border p-6"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                        <Files className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-foreground font-semibold text-sm">No files uploaded yet</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Drag and drop files anywhere onto this window, or click Upload Files above.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => nativeFileInputRef.current?.click()}
                        className="mt-1 gap-1.5 text-xs font-medium"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Select Files</span>
                      </Button>
                    </motion.div>
                  </AnimatePresence>
                ) : filteredFiles.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground bg-card/30 rounded-2xl border border-border">
                    No files matched your search or category filter.
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredFiles.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        onDelete={setFileToDelete}
                        onMove={setFileToMove}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFiles.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        onDelete={setFileToDelete}
                        onMove={setFileToMove}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Right Column: Code & Text Stream Pane */}
          {(workspaceView === "dual" || workspaceView === "code") && (
            <div
              className={cn(
                "space-y-4",
                workspaceView === "dual" ? "lg:col-span-5" : "w-full"
              )}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-emerald-500" />
                    <span>Code &amp; Text Stream</span>
                  </h2>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    ({filteredTextMessages.length}
                    {filteredTextMessages.length !== (textMessages?.length ?? 0)
                      ? ` of ${textMessages?.length ?? 0}`
                      : ""}
                    )
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={openTextMessageDialog}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Detailed Form</span>
                </Button>
              </div>

              {/* Snippet Search & Language Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search code, notes, syntax..."
                    value={textSearchQuery}
                    onChange={(e) => setTextSearchQuery(e.target.value)}
                    className="pl-9 pr-8 h-9 text-xs bg-card/60 border-border/80 rounded-xl"
                  />
                  {textSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTextSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {availableTextLangs.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setTextLangFilter("all")}
                      className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg transition-all whitespace-nowrap ${
                        textLangFilter === "all"
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground bg-secondary/40 border border-border/40"
                      }`}
                    >
                      All ({textMessages?.length || 0})
                    </button>
                    {availableTextLangs.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setTextLangFilter(lang)}
                        className={`px-2 py-1 text-[11px] font-mono font-medium rounded-lg transition-all capitalize whitespace-nowrap ${
                          textLangFilter.toLowerCase() === lang.toLowerCase()
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground bg-secondary/40 border border-border/40"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Text & Code Timeline Cards */}
              {filteredTextMessages.length > 0 ? (
                <div className="space-y-3">
                  {filteredTextMessages.map((message) => (
                    <TextMessageCard
                      key={message.id}
                      message={message}
                      onDelete={handleDeleteTextMessage}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center mx-auto text-muted-foreground">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {textSearchQuery || textLangFilter !== "all"
                      ? "No code snippets match your filter"
                      : "No text or code snippets yet"}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    Use the Quick Composer at the top to write, paste, and auto-detect any code snippet with instant timestamps.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FolderShareDialog
        folder={safeFolders?.find((folder) => folder.id === folderToShare) || null}
        open={!!folderToShare}
        onOpenChange={(open) => !open && setFolderToShare(null)}
      />

      {/* Move file dialog */}
      <Dialog open={!!fileToMove} onOpenChange={(open) => !open && setFileToMove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>Select a destination folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-y-auto py-1">
            <button
              onClick={() => handleMove("root")}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-secondary"
            >
              My Files (no folder)
            </button>
            {activeRoom && (
              <button
                key={activeRoom.id}
                onClick={() => handleMove(activeRoom.id)}
                disabled={activeRoom.id === currentFolderId}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <Lock className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="truncate">{activeRoom.name}</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 uppercase tracking-wide shrink-0">
                  Private Room
                </span>
              </button>
            )}
            {safeFolders?.map((f) => (
              <button
                key={f.id}
                onClick={() => handleMove(f.id)}
                disabled={f.id === currentFolderId}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  f.id === currentFolderId
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-secondary"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFileToMove(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete file dialog */}
      <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the file.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFileToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder dialog */}
      <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete folder?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The folder will be deleted. Files inside will be moved back to My Files.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolderConfirm}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create folder dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create new folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name" className="text-xs font-semibold">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="folder-password" className="text-xs font-semibold">Room Password <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="folder-password"
                type="password"
                placeholder="Lock folder with password"
                value={newFolderPassword}
                onChange={(e) => setNewFolderPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Auto-Dissolve in</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "1 Hour", value: "3600" },
                  { label: "1 Day", value: "86400" },
                  { label: "3 Days (Default)", value: "259200" },
                  { label: "1 Week", value: "604800" },
                  { label: "Keep Forever", value: "forever" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={newFolderDuration === opt.value ? "default" : "outline"}
                    className={`h-9 text-xs justify-start px-2 font-medium ${
                      newFolderDuration === opt.value ? "bg-primary text-primary-foreground font-semibold" : ""
                    }`}
                    onClick={() => setNewFolderDuration(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textMessageOpen} onOpenChange={setTextMessageOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New text or code</DialogTitle>
            <DialogDescription>
              Whitespace, indentation, symbols, and line breaks are preserved exactly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(event) => setTextTitle(event.target.value)}
              />
              <select
                value={textLanguage}
                onChange={(event) => setTextLanguage(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Language"
              >
                <option value="plaintext">Plain text</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="sql">SQL</option>
                <option value="markdown">Markdown</option>
                <option value="bash">Bash</option>
              </select>
            </div>
            <Textarea
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
              placeholder="Paste or type your text here..."
              className="min-h-[260px] resize-y font-mono text-sm leading-6"
              spellCheck={false}
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Folder</span>
                <select
                  value={textFolderId}
                  onChange={(event) => setTextFolderId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">My Files (no folder)</option>
                  {safeFolders?.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Link to a file <span className="font-normal text-muted-foreground">(optional)</span></span>
                <select
                  value={linkedFileId}
                  onChange={(event) => setLinkedFileId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">No linked file</option>
                  {allFiles?.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
                </select>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTextMessageOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTextMessage} disabled={!textContent || createTextMessage.isPending}>
              {createTextMessage.isPending ? "Saving..." : "Save text"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ChangeExpirationDialog />
      <GoogleDriveModal
        open={googleDriveOpen}
        onOpenChange={setGoogleDriveOpen}
        onImportFile={(file) => handleFileSelect(file)}
      />

      {folderToUnlock && (
        <GlassmorphicUnlockModal
          title={folderToUnlock.name}
          isFolder={true}
          subTitle={folderToUnlock.fileCount ? `Protected folder with ${folderToUnlock.fileCount} items` : "This folder is protected by a password"}
          onUnlock={async (pass) => {
            try {
              const res = await fetch(`/api/folders/${folderToUnlock.id}/unlock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: pass }),
              });
              if (!res.ok) return false;
              setUnlockedFolders((prev) => ({ ...prev, [folderToUnlock.id]: true }));
              setCurrentFolderId(folderToUnlock.id);
              setFolderToUnlock(null);
              toast({ title: "Folder unlocked", description: `Opened "${folderToUnlock.name}"` });
              return true;
            } catch {
              return false;
            }
          }}
          onCancel={() => setFolderToUnlock(null)}
        />
      )}
    </Layout>
  );
}
