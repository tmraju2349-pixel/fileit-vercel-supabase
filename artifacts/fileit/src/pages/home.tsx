import { Layout } from "@/components/layout";
import {
  useListFiles,
  useDeleteFile,
  useMoveFile,
  useListFolders,
  useCreateFolder,
  useDeleteFolder,
  useListTextMessages,
  useDeleteTextMessage,
  type FolderRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { getActiveRoom } from "@/lib/rooms-storage";
import { FileCard, FileCardSkeleton } from "@/components/file-card";
import { FolderCard } from "@/components/folder-card";
import { FolderShareDialog } from "@/components/folder-share-dialog";
import { TextMessageCard } from "@/components/text-message-card";
import { useUpload } from "@/hooks/use-upload";
import { ChangeExpirationDialog } from "@/components/change-expiration-dialog";
import { GoogleDriveModal } from "@/components/google-drive-modal";
import { GlassmorphicUnlockModal } from "@/components/glassmorphic-unlock-modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  Search,
  LayoutGrid,
  List,
  X,
  UploadCloud,
  Clock,
  Lock,
  ArrowLeft,
  Plus,
  ChevronRight,
  FolderPlus,
  FolderInput,
  Inbox,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";

type FeedFilter = "all" | "files" | "code" | "text";

interface UnifiedFeedItem {
  id: string;
  kind: "file" | "text" | "code";
  createdAt: string | number;
  originalData: any;
}

export default function HomePage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Dialog & Folder States
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [fileToMove, setFileToMove] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderPassword, setNewFolderPassword] = useState("");
  const [newFolderDuration, setNewFolderDuration] = useState<string>("259200");
  const [folderToShare, setFolderToShare] = useState<FolderRecord | null>(null);
  const [googleDriveOpen, setGoogleDriveOpen] = useState(false);
  const [unlockedFolders, setUnlockedFolders] = useState<Record<string, boolean>>({});
  const [folderToUnlock, setFolderToUnlock] = useState<any | null>(null);

  // Hidden Drag-and-Drop Overlay States
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [dragFileCount, setDragFileCount] = useState(0);
  const [isIslandDropHovered, setIsIslandDropHovered] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [, setLocation] = useLocation();
  const [activeRoom] = useState(() => getActiveRoom());

  const { uploadFile, isUploading, progress } = useUpload();
  const deleteFile = useDeleteFile();
  const moveFile = useMoveFile();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const deleteTextMessage = useDeleteTextMessage();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: files, isLoading: filesLoading } = useListFiles(
    currentFolderId ? { folderId: currentFolderId } : undefined
  );
  const { data: folders } = useListFolders();
  const { data: textMessages, isLoading: textsLoading } = useListTextMessages(
    currentFolderId ? { folderId: currentFolderId } : undefined
  );

  const safeFolders = useMemo(() => (Array.isArray(folders) ? folders : []), [folders]);
  const currentFolder = safeFolders.find((f) => f.id === currentFolderId);

  // Keyboard shortcut `/` to focus search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Dynamic folders list: include active room if applicable
  const displayFolders = useMemo(() => {
    const list = [...safeFolders];
    if (activeRoom && !list.some((f) => f.id === activeRoom.id)) {
      list.unshift({
        id: activeRoom.id,
        name: activeRoom.name,
        password: "true",
        expiresAt: activeRoom.expiresAt,
        createdAt: activeRoom.joinedAt,
        shareToken: activeRoom.token,
        fileCount: 0,
      } as any);
    }
    return list;
  }, [safeFolders, activeRoom]);

  // All items sorted chronologically (before filter tabs, so tab counts stay accurate)
  const allItems = useMemo(() => {
    const items: UnifiedFeedItem[] = [];

    if (files && Array.isArray(files)) {
      files.forEach((f) => {
        items.push({
          id: `file_${f.id}`,
          kind: "file",
          createdAt: f.createdAt || Date.now(),
          originalData: f,
        });
      });
    }

    if (textMessages && Array.isArray(textMessages)) {
      textMessages.forEach((msg) => {
        const lang = (msg.language || "plaintext").toLowerCase();
        const isCode = !["plaintext", "text", "chat"].includes(lang);
        items.push({
          id: `text_${msg.id}`,
          kind: isCode ? "code" : "text",
          createdAt: msg.createdAt || Date.now(),
          originalData: msg,
        });
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [files, textMessages]);

  const counts = useMemo(() => {
    return {
      all: allItems.length,
      files: allItems.filter((i) => i.kind === "file").length,
      code: allItems.filter((i) => i.kind === "code").length,
      text: allItems.filter((i) => i.kind === "text").length,
    };
  }, [allItems]);

  const unifiedFeed = useMemo(() => {
    return allItems.filter((item) => {
      if (feedFilter === "files" && item.kind !== "file") return false;
      if (feedFilter === "code" && item.kind !== "code") return false;
      if (feedFilter === "text" && item.kind !== "text") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (item.kind === "file") {
          return item.originalData.originalName?.toLowerCase().includes(q);
        }
        const matchTitle = item.originalData.title?.toLowerCase().includes(q);
        const matchContent = item.originalData.content?.toLowerCase().includes(q);
        const matchLang = item.originalData.language?.toLowerCase().includes(q);
        return Boolean(matchTitle || matchContent || matchLang);
      }

      return true;
    });
  }, [allItems, feedFilter, searchQuery]);

  // Listen to folder card drag-drop events
  useEffect(() => {
    const handleFileMoveToFolder = async (e: Event) => {
      const { fileId, folderId, folderName } = (e as CustomEvent).detail;
      try {
        await moveFile.mutateAsync({ id: fileId, data: { folderId } });
        queryClient.invalidateQueries({ queryKey: ["/api/files"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        toast({ title: "Moved to folder", description: `Placed inside "${folderName}".` });
      } catch {
        toast({ variant: "destructive", title: "Failed to move file" });
      }
    };

    const handleOsFilesToFolder = async (e: Event) => {
      const { files: droppedFiles, folderId, folderName } = (e as CustomEvent).detail;
      const list = Array.from(droppedFiles as FileList);
      try {
        for (const file of list) {
          await uploadFile(file, folderId);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/files"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        toast({ title: "Uploaded to folder", description: `Added ${list.length} item(s) to "${folderName}".` });
      } catch {
        toast({ variant: "destructive", title: "Upload failed" });
      }
    };

    window.addEventListener("file-drop-to-folder", handleFileMoveToFolder);
    window.addEventListener("os-files-drop-to-folder", handleOsFilesToFolder);
    return () => {
      window.removeEventListener("file-drop-to-folder", handleFileMoveToFolder);
      window.removeEventListener("os-files-drop-to-folder", handleOsFilesToFolder);
    };
  }, [moveFile, uploadFile, queryClient, toast]);

  // Hidden Full-Window Drag-and-Drop Listeners
  useEffect(() => {
    const isFileDrag = (e: DragEvent) => {
      const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
      return types.includes("Files") || (e.dataTransfer?.files?.length ?? 0) > 0;
    };

    const resetDragState = () => {
      dragCounterRef.current = 0;
      setIsWindowDragging(false);
      setDragFileCount(0);
      setIsIslandDropHovered(false);
    };

    const handleDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounterRef.current++;
      setIsWindowDragging(true);
      const count = e.dataTransfer?.items?.length || e.dataTransfer?.files?.length || 0;
      if (count > 0) setDragFileCount(count);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (
        dragCounterRef.current <= 0 ||
        (e.clientX <= 0 && e.clientY <= 0)
      ) {
        dragCounterRef.current = 0;
        setIsWindowDragging(false);
        setDragFileCount(0);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setIsWindowDragging(true);
    };

    const handleDrop = async (e: DragEvent) => {
      if (!isFileDrag(e)) {
        resetDragState();
        return;
      }
      e.preventDefault();
      resetDragState();

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files);
        try {
          for (const file of droppedFiles) {
            await uploadFile(file, currentFolderId || undefined);
          }
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        } catch {
          toast({
            variant: "destructive",
            title: "Upload incomplete",
            description: "Some files could not be uploaded.",
          });
        }
      }
    };

    const handleIslandDragState = (e: Event) => {
      const detail = (e as CustomEvent<{ isDragOver: boolean }>).detail;
      setIsIslandDropHovered(Boolean(detail?.isDragOver));
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", resetDragState);
    window.addEventListener("blur", resetDragState);
    window.addEventListener("fileit-drag-cleanup", resetDragState);
    window.addEventListener("fileit-island-drag-state", handleIslandDragState);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", resetDragState);
      window.removeEventListener("blur", resetDragState);
      window.removeEventListener("fileit-drag-cleanup", resetDragState);
      window.removeEventListener("fileit-island-drag-state", handleIslandDragState);
    };
  }, [uploadFile, currentFolderId, queryClient, toast]);

  const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFiles = Array.from(e.target.files);
    try {
      for (const file of selectedFiles) {
        await uploadFile(file, currentFolderId || undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    } catch {
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      e.target.value = "";
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const expiresAt =
        newFolderDuration === "forever"
          ? undefined
          : new Date(Date.now() + parseInt(newFolderDuration, 10) * 1000).toISOString();

      await createFolder.mutateAsync({
        data: {
          name: newFolderName.trim(),
          password: newFolderPassword.trim() || undefined,
          expiresAt,
        } as any,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setCreateFolderOpen(false);
      setNewFolderName("");
      setNewFolderPassword("");
      toast({ title: "Folder created", description: `"${newFolderName.trim()}" is ready.` });
    } catch {
      toast({ variant: "destructive", title: "Failed to create folder" });
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      await deleteFile.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setFileToDelete(null);
      toast({ title: "File deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete file" });
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await deleteFolder.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      if (currentFolderId === id) {
        setCurrentFolderId(null);
      }
      setFolderToDelete(null);
      toast({ title: "Folder deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete folder" });
    }
  };

  const handleDeleteTextMessage = async (id: string) => {
    try {
      await deleteTextMessage.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/text-messages"] });
      toast({ title: "Entry deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete entry" });
    }
  };

  const handleMoveToFolder = async (fileId: string, folderId: string | null) => {
    try {
      await moveFile.mutateAsync({ id: fileId, data: { folderId } });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setFileToMove(null);
      toast({ title: "File moved" });
    } catch {
      toast({ variant: "destructive", title: "Failed to move file" });
    }
  };

  const handleFolderClick = (folder: any) => {
    if (activeRoom && folder.id === activeRoom.id) {
      setLocation(`/rooms/${activeRoom.id}`);
      return;
    }
    if (folder.password && !unlockedFolders[folder.id]) {
      setFolderToUnlock(folder);
      return;
    }
    setCurrentFolderId(folder.id);
  };

  const isLoading = filesLoading || textsLoading;

  return (
    <Layout>
      {/* Hidden file input for manual uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleManualFileSelect}
      />

      {/* Hidden Ambient Glow Drop Box (Appears only while files hover over the page) */}
      <AnimatePresence>
        {isWindowDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            aria-hidden="true"
            className="fixed inset-0 z-[99999] pointer-events-none bg-background/75 backdrop-blur-md shadow-[inset_0_0_110px_hsl(var(--primary)/0.22)] flex items-center justify-center p-6"
          >
            {/* Ambient radial glow backdrop */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.16),transparent_60%)]" />

            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{
                scale: isIslandDropHovered ? 0.94 : 1,
                opacity: isIslandDropHovered ? 0.35 : 1,
              }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative max-w-md w-full p-8 rounded-2xl border-2 border-dashed border-primary bg-card/95 ring-4 ring-primary/20 shadow-[0_0_65px_-6px_hsl(var(--primary)/0.6)] flex flex-col items-center text-center gap-3.5"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-primary/35 blur-xl" />
                <div className="relative w-14 h-14 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-7 h-7" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-foreground tracking-tight">
                  {dragFileCount > 1
                    ? `Drop ${dragFileCount} files to upload`
                    : "Drop files to upload"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Adding directly to{" "}
                  <span className="font-semibold text-foreground">
                    {currentFolder ? currentFolder.name : "Vault"}
                  </span>
                </p>
                <p className="text-xs text-primary/90 font-medium pt-0.5">
                  Or hover over Fileit Island above to stage &amp; bundle
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl space-y-8">
        {/* Clean Workspace Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="space-y-1.5 min-w-0">
            {currentFolder ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(null)}
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Vault</span>
                </button>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                <span className="text-foreground font-medium truncate">{currentFolder.name}</span>
              </div>
            ) : null}

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {currentFolder ? currentFolder.name : "Vault"}
            </h1>

            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground font-mono tabular-nums">
              <span>{counts.all} {counts.all === 1 ? "item" : "items"}</span>
              {!currentFolderId && displayFolders.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{displayFolders.length} {displayFolders.length === 1 ? "folder" : "folders"}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-sans">Drag &amp; drop files anywhere</span>
            </div>
          </div>

          {/* Streamlined Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {!currentFolderId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateFolderOpen(true)}
                className="h-9 px-3.5 rounded-lg text-xs font-medium gap-1.5 whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Folder</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3.5 rounded-lg text-xs font-medium gap-1.5 whitespace-nowrap shrink-0"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload</span>
            </Button>

            <Link href="/add">
              <Button
                size="sm"
                className="h-9 px-4 rounded-lg text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note / Code</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Live Upload Progress Strip */}
        {isUploading && (
          <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-foreground">Uploading files...</span>
              <span className="font-mono tabular-nums text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Folders Strip (Only at Root) */}
        {!currentFolderId && displayFolders.length > 0 && (
          <section className="space-y-3" aria-label="Folders">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground tracking-wide">
                Folders
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {displayFolders.map((folder, index) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  index={index}
                  fileCount={folder.fileCount}
                  onClick={() => handleFolderClick(folder)}
                  onDelete={() => setFolderToDelete(folder.id)}
                  onShare={() => setFolderToShare(folder)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Unified Stream Controls: Filter Tabs + Search + View Switch */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
            {/* Segmented Filter Bar */}
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-secondary/70 border border-border/50 overflow-x-auto no-scrollbar self-start">
              {(
                [
                  { id: "all", label: "All", count: counts.all },
                  { id: "files", label: "Files", count: counts.files },
                  { id: "code", label: "Code", count: counts.code },
                  { id: "text", label: "Notes", count: counts.text },
                ] as const
              ).map((tab) => {
                const active = feedFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFeedFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                      active
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        active ? "text-foreground/70" : "text-muted-foreground/70"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search & View Mode */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vault... ( / )"
                  className="h-9 pl-8 pr-8 text-xs rounded-lg bg-card border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="inline-flex items-center p-0.5 rounded-lg border border-border/80 bg-card shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
                    viewMode === "list"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="List view"
                  aria-label="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
                    viewMode === "grid"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Unified Chronological Timeline */}
          {isLoading ? (
            <div className="space-y-2.5">
              {[...Array(4)].map((_, i) => (
                <FileCardSkeleton key={i} />
              ))}
            </div>
          ) : unifiedFeed.length > 0 ? (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-3 items-start" : "space-y-2.5"}>
              {unifiedFeed.map((item) => {
                if (item.kind === "file") {
                  return (
                    <FileCard
                      key={item.id}
                      file={item.originalData}
                      onDelete={(id) => setFileToDelete(id)}
                      onMove={(id) => setFileToMove(id)}
                    />
                  );
                }
                return (
                  <TextMessageCard
                    key={item.id}
                    message={item.originalData}
                    onDelete={(id) => handleDeleteTextMessage(id)}
                  />
                );
              })}
            </div>
          ) : (
            /* Clean Empty State */
            <div className="py-16 px-6 rounded-xl border border-dashed border-border/80 bg-card/50 text-center space-y-4">
              <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                <Inbox className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-semibold text-foreground">
                  {searchQuery ? "No matching items" : "This vault is empty"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {searchQuery
                    ? "Try adjusting your search or filter to find what you're looking for."
                    : "Drop any file directly onto this window, or write a quick note or code snippet."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                {searchQuery ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setFeedFilter("all");
                    }}
                    className="h-9 px-4 rounded-lg text-xs font-medium"
                  >
                    Clear filters
                  </Button>
                ) : (
                  <>
                    <Link href="/add">
                      <Button size="sm" className="h-9 px-4 rounded-lg text-xs font-semibold gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Note / Code</span>
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-4 rounded-lg text-xs font-medium"
                    >
                      Upload File
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateFolder}>
            <DialogHeader>
              <DialogTitle>New Folder</DialogTitle>
              <DialogDescription>
                Group files and snippets with optional password protection and auto-dissolve duration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="folder-name" className="text-xs font-medium">
                  Folder name
                </Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Design Assets, API Snippets"
                  className="rounded-lg text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="folder-pwd" className="text-xs font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Password lock (optional)</span>
                </Label>
                <Input
                  id="folder-pwd"
                  type="password"
                  value={newFolderPassword}
                  onChange={(e) => setNewFolderPassword(e.target.value)}
                  placeholder="Leave blank for open access"
                  className="rounded-lg text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Auto-dissolve timer</span>
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "1 Hour", value: "3600" },
                    { label: "1 Day", value: "86400" },
                    { label: "3 Days", value: "259200" },
                    { label: "1 Week", value: "604800" },
                    { label: "Keep Forever", value: "forever" },
                  ].map((dur) => (
                    <button
                      key={dur.value}
                      type="button"
                      onClick={() => setNewFolderDuration(dur.value)}
                      className={`py-2 px-2.5 text-center rounded-lg text-xs font-medium border transition-colors ${
                        newFolderDuration === dur.value
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "border-border/80 hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateFolderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newFolderName.trim() || createFolder.isPending}>
                {createFolder.isPending ? "Creating..." : "Create Folder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move File to Folder Dialog */}
      <Dialog open={!!fileToMove} onOpenChange={(open) => !open && setFileToMove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="w-4 h-4 text-primary" />
              <span>Move to folder</span>
            </DialogTitle>
            <DialogDescription>Choose a destination folder for this file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2 max-h-64 overflow-y-auto">
            {currentFolderId && (
              <button
                type="button"
                onClick={() => fileToMove && handleMoveToFolder(fileToMove, null)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm hover:bg-secondary transition-colors border border-border/60"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Root Vault</span>
              </button>
            )}
            {safeFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                disabled={folder.id === currentFolderId}
                onClick={() => fileToMove && handleMoveToFolder(fileToMove, folder.id)}
                className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm hover:bg-secondary disabled:opacity-45 transition-colors border border-border/60"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{folder.name}</span>
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {folder.fileCount}
                </span>
              </button>
            ))}
            {safeFolders.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No folders created yet.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFileToMove(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete File Dialog */}
      <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove this file? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFileToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteFile.isPending}
              onClick={() => fileToDelete && handleDeleteFile(fileToDelete)}
            >
              {deleteFile.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete folder</DialogTitle>
            <DialogDescription>
              This will delete the folder and remove its association from contained files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFolderToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteFolder.isPending}
              onClick={() => folderToDelete && handleDeleteFolder(folderToDelete)}
            >
              {deleteFolder.isPending ? "Deleting..." : "Delete Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Share Dialog */}
      <FolderShareDialog
        folder={folderToShare}
        open={!!folderToShare}
        onOpenChange={(open) => !open && setFolderToShare(null)}
      />

      {/* Glassmorphic Unlock Modal */}
      {folderToUnlock && (
        <GlassmorphicUnlockModal
          title={folderToUnlock.name}
          isFolder={true}
          onCancel={() => setFolderToUnlock(null)}
          onUnlock={async (enteredPwd) => {
            if (enteredPwd === folderToUnlock.password) {
              setUnlockedFolders((prev) => ({ ...prev, [folderToUnlock.id]: true }));
              setCurrentFolderId(folderToUnlock.id);
              setFolderToUnlock(null);
              toast({ title: "Folder unlocked" });
              return true;
            }
            toast({ variant: "destructive", title: "Incorrect password" });
            return false;
          }}
        />
      )}

      {/* Google Drive Modal */}
      <GoogleDriveModal
        open={googleDriveOpen}
        onOpenChange={setGoogleDriveOpen}
        onImportFile={async (file) => {
          await uploadFile(file, currentFolderId || undefined);
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        }}
      />

      <ChangeExpirationDialog />
    </Layout>
  );
}
