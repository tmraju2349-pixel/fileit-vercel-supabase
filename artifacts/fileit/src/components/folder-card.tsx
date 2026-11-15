import { Folder, Share2, Trash2, Lock, Clock, KeyRound } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { FolderRecord } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { formatTimeRemaining } from "@/lib/rooms-storage";
import { PasswordProtectDialog } from "@/components/password-protect-dialog";

interface FolderCardProps {
  folder: FolderRecord;
  onClick: () => void;
  onDelete: () => void;
  onShare: () => void;
  fileCount?: number;
  index?: number;
}

export function FolderCard({ folder, onClick, onDelete, onShare, fileCount, index = 0 }: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const fileId = e.dataTransfer.getData("fileId");
    if (fileId) {
      // Dispatch custom event to move existing file into this folder/room
      const event = new CustomEvent("file-drop-to-folder", {
        detail: { fileId, folderId: folder.id, folderName: folder.name },
        bubbles: true,
      });
      e.currentTarget.dispatchEvent(event);
      return;
    }

    // Handle dropping OS files directly onto this folder card
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const event = new CustomEvent("os-files-drop-to-folder", {
        detail: { files: e.dataTransfer.files, folderId: folder.id, folderName: folder.name },
        bubbles: true,
      });
      e.currentTarget.dispatchEvent(event);
    }
  };

  const timeRemaining = formatTimeRemaining(folder.expiresAt || undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.15), ease: "easeOut" }}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative flex items-center justify-between gap-2.5 p-3 rounded-xl border bg-card cursor-pointer transition-colors ${
        isDragOver
          ? "border-primary border-dashed bg-primary/5 ring-2 ring-primary/20"
          : "border-border/80 hover:border-foreground/25"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border border-border/50 ${
            folder.password
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-secondary/80 text-foreground/80"
          }`}
        >
          {folder.password ? <Lock className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground" title={folder.name}>
              {folder.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5 truncate">
            {fileCount !== undefined ? (
              <span>
                {fileCount} {fileCount === 1 ? "item" : "items"}
              </span>
            ) : (
              <span>{folder.password ? "Locked" : "Folder"}</span>
            )}
            {folder.expiresAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className={timeRemaining.isUrgent ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                  {timeRemaining.text}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex sm:hidden sm:group-hover:flex group-focus-within:flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPasswordDialogOpen(true);
          }}
          className={`p-1.5 rounded-lg transition-colors ${
            folder.password
              ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
          aria-label="Manage Password Lock"
          title={folder.password ? "Manage Password Lock" : "Protect Folder with Password"}
        >
          <Lock className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const event = new CustomEvent("change-folder-expiration", {
              detail: { folderId: folder.id, name: folder.name, currentExpiresAt: folder.expiresAt },
              bubbles: true,
            });
            window.dispatchEvent(event);
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Change Expiration"
          title="Change Dissolve Timer"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Share folder"
          title="Share folder"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Delete folder"
          title="Delete folder"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <PasswordProtectDialog
        isOpen={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
        targetId={folder.id}
        targetName={folder.name}
        type="folder"
        isProtected={Boolean(folder.password || (folder as any).isProtected)}
        hasOwnPassword={Boolean(folder.password || (folder as any).hasPassword)}
      />
    </motion.div>
  );
}
