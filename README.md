# Fileit — Ephemeral File Vault, Collaborative PDF Studio & P2P Data Beam

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000.svg)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC.svg)](https://tailwindcss.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Mesh-green.svg)](https://webrtc.org/)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](#license--copyright)

> **Fileit** is a privacy-first, decentralized workspace for ephemeral file transfers, collaborative real-time PDF annotation, multi-app sharing, and zero-leak 3-day self-dissolving rooms.

---

## Key Features

### 1. Collaborative PDF Studio & Real-Time Markup
- **Native Document Viewing**: Fast, vector-crisp PDF rendering with dark reading mode, zoom (50%–250%), 90° rotation, and print triggers.
- **Real-Time Collaborative Annotations**: Add text boxes, multi-color highlighters, approval stamps (`APPROVED`, `CONFIDENTIAL`, `REVIEWED`, `SIGNED`, `REJECTED`), and freehand vector markup.
- **Real-Time P2P Mesh Sync**: Broadcasts live annotations across peer data channels and synchronizes with server state.
- **Flattened PDF Export**: Generates high-fidelity flattened PDFs with burned-in annotations using `html2canvas` and `jsPDF`.
- **1-Click Vault Save**: Save annotated documents directly back to the active room vault.

### 2. Multi-App Document Export & Native Sharing
- **Native OS Share Sheet**: Seamlessly triggers mobile and desktop operating system share sheets with attached file payloads and secure links.
- **1-Click Social Sharing**: Direct app shortcuts for **WhatsApp**, **Telegram**, **Gmail**, and formatted **Slack/Teams markdown notices**.
- **Everywhere Integration**: Available across file cards, PDF studio toolbars, full-screen previews, and room vaults.

### 3. Dual-Layer Protection & Glassmorphic Unlock
- **Folder-Level Password Locks**: Secure entire room vaults and directories with password encryption.
- **Per-File Overrides**: Assign individual passwords to sensitive files within shared folders.
- **Glassmorphic Unlock Modal**: Password-protected URLs render a blurred aesthetic backdrop with client-side credential verification before streaming contents.
- **Zero Metadata Leakage**: Storage paths and payload downloads are completely withheld by backend APIs until valid unlock authentication is provided.

### 4. 3-Day Zero-Leak Ephemeral Dissolution
- **Automated Lifecycle TTL**: All uploaded documents, folders, and text messages automatically dissolve after 72 hours (3 days) unless starred.
- **Dissolve Timers**: Real-time remaining countdowns with urgent visual badges.
- **Instant Room Dissolution**: 1-click room eradication deletes files, scratchpads, whiteboards, and database rows permanently.

### 5. P2P Direct Mesh Radar & File Beam
- **Serverless WebRTC Transfers**: Stream files peer-to-peer directly between browser windows without storing payloads on cloud disks.
- **P2P Mesh Discovery**: Ephemeral room mesh for low-latency synchronization of whiteboard strokes, document scratchpads, and live comments.

### 6. Universal File & Code Interchange
- **In-Browser Previews**: Native viewers for PDF, DOCX, XLSX, PPTX, APK, ZIP archives, images, audio, video, and code.
- **Code & Text Snippet Studio**: Create, format, and export snippets to `.js`, `.py`, `.ts`, `.html`, `.css`, `.json`, `.sql`, `.sh`, and `.txt`.
- **Dynamic Bubble**: Minimize active documents into a floating multi-tasking bubble for split-screen comparison.

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Vite React Frontend (:3000)                    │
│  - Collaborative PDF Studio (Annotation Canvas, jsPDF, html2canvas)   │
│  - Multi-App Export Modal (Native OS Share Sheet, WhatsApp, Slack)     │
│  - Glassmorphic Unlock Protection & Password Dialogs                  │
│  - WebRTC P2P Mesh Manager (DataChannels, Canvas & Document Sync)     │
│  - Dynamic Bubble Multi-tasking Dock & Split-Screen Viewers           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / Server-Sent Streams
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Express API Server (:3001)                      │
│  - Routes: /api/files, /api/folders, /api/rooms, /api/text-messages    │
│  - PDF Inline Streaming (/api/files/:id/download, /api/storage/*)      │
│  - Multipart File Ingestion & Automatic 72-Hour Expiration Engine      │
│  - Role & Password Protection Middleware (Dual-layer Lock Evaluation)  │
│  - ZIP Archive Generation (Archiver streaming for rooms & folders)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌──────────────────────────────┐            ┌─────────────────────────────┐
│  PostgreSQL / Drizzle ORM    │            │ Local Disk / Supabase Store │
│  - Files, Folders, Rooms     │            │ - Chunked uploads           │
│  - Ephemeral TTL Indices     │            │ - Private file storage      │
│  - Audit Events & Snippets   │            │ - Signed upload URLs        │
└──────────────────────────────┘            └─────────────────────────────┘
```

---

## Directory Layout

```text
├── artifacts/
│   ├── api-server/              # Backend Express Node.js application
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── files.ts     # Files, folders, rooms, PDF endpoints, ZIP downloads
│   │   │   │   ├── convert.ts   # Document format converters
│   │   │   │   ├── webrtc.ts    # WebRTC signaling
│   │   │   │   └── health.ts    # Liveness check (/api/health)
│   │   │   ├── lib/
│   │   │   │   ├── fileStorage.ts      # Multi-candidate file stream resolver
│   │   │   │   └── supabaseStorage.ts  # Supabase object storage driver
│   │   │   └── db/
│   │   │       ├── schema.ts    # Drizzle ORM table definitions
│   │   │       └── index.ts     # Database client connection
│   │   └── package.json
│   └── fileit/                  # Vite + React 18 frontend client
│       ├── src/
│       │   ├── components/
│       │   │   ├── pdf-studio-preview.tsx       # PDF Studio with vector annotation overlay
│       │   │   ├── room-pdf-collaborator.tsx    # Live multi-peer PDF collaboration
│       │   │   ├── export-share-modal.tsx       # Multi-app export & native OS share sheet
│       │   │   ├── glassmorphic-unlock-modal.tsx# Frosted glass unlock interface
│       │   │   ├── file-card.tsx                # File row with action shortcuts
│       │   │   ├── folder-card.tsx              # Folder card with drag-drop targets
│       │   │   └── fullscreen-preview-modal.tsx # Studio previewer with keyboard shortcuts
│       │   ├── pages/
│       │   │   ├── files.tsx         # Primary document drive & folders
│       │   │   ├── view.tsx          # Single document view & unlock gateway
│       │   │   ├── share.tsx         # Public document delivery page
│       │   │   ├── room-view.tsx     # Ephemeral dissolving collaboration room
│       │   │   ├── rooms-hub.tsx     # Rooms dashboard & join interface
│       │   │   └── text-studio.tsx   # Code & text snippet editor
│       │   └── lib/
│       │       ├── export-share-helper.ts # Native share API & app link builder
│       │       ├── room-p2p-mesh.ts       # Peer-to-peer WebRTC mesh driver
│       │       └── storage.ts             # Storage URL helpers
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── dev.sh                       # Dual-process dev launcher (Express on 3001, Vite on 3000)
├── server.ts                    # Production entry point server
├── package.json                 # Monorepo workspaces manifest
└── README.md                    # Project documentation
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun**

### 1. Installation
Clone the repository and install all dependencies across workspaces:

```bash
git clone https://github.com/<your-username>/fileit.git
cd fileit
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory (or configure environment variables in your deployment host):

```env
PORT=3000
NODE_ENV=development

# Optional: Cloud Object Storage (defaults to high-performance local disk storage if omitted)
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# SUPABASE_STORAGE_BUCKET=fileit

# Database connection string (PostgreSQL)
# DATABASE_URL=postgresql://postgres:password@localhost:5432/fileit
```

### 3. Running in Development
Start both the backend API server and the Vite React frontend:

```bash
npm run dev
```

- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001` (proxied automatically via `/api/*`)

### 4. Production Build & Start

```bash
# Build all workspaces
npm run build

# Start production server
npm start
```

---

## API Reference

### File Management
| Method | Route | Description | Authentication |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/files` | List active user files (filters out expired files) | Optional `folderId` query |
| `GET` | `/api/files/:id` | Get file metadata (masked if locked) | Optional password header |
| `GET` | `/api/files/:id/download` | Stream file inline or as attachment | Share token / Password |
| `POST` | `/api/upload` | Multipart file upload | Public |
| `POST` | `/api/files/:id/unlock` | Verify password and reveal payload URL | JSON `{ password }` |
| `PUT` | `/api/files/:id/password` | Set, change, or remove password lock | JSON `{ password }` |
| `PUT` | `/api/files/:id/star` | Toggle star status (exempts from 72h TTL) | None |
| `DELETE`| `/api/files/:id` | Permanently delete file and purge disk storage | None |

### Folders & Vaults
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/folders` | List folders with item counts and expiration countdowns |
| `POST` | `/api/folders` | Create new folder with optional password lock |
| `GET` | `/api/folders/share/:token` | Fetch folder contents by public share token |
| `GET` | `/api/folders/share/:token/download` | Stream entire folder contents as a `.zip` archive |
| `PUT` | `/api/folders/:id/password` | Update folder password lock |
| `DELETE`| `/api/folders/:id` | Delete folder and cascade purge files |

### Ephemeral Collaborative Rooms
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/rooms/create` | Provision password-protected 3-day dissolving room |
| `POST` | `/api/rooms/join` | Authenticate into room via name and password |
| `GET` | `/api/rooms/:id` | Retrieve room vault files, snippets, and activity log |
| `POST` | `/api/rooms/:id/files` | Upload file directly or move existing file into room |
| `GET` | `/api/rooms/:id/download` | Download all room files as a single `.zip` archive |
| `GET` | `/api/rooms/:id/pdf-annotations/:fileId` | Fetch stored collaborative PDF annotations |
| `POST` | `/api/rooms/:id/pdf-annotations/:fileId` | Upsert collaborative annotations for room PDF |
| `GET` | `/api/rooms/:id/canvas` | Retrieve synchronized collaborative whiteboard state |
| `POST` | `/api/rooms/:id/canvas` | Save synchronized collaborative whiteboard state |
| `GET` | `/api/rooms/:id/document` | Fetch shared collaborative markdown document |
| `PUT` | `/api/rooms/:id/document` | Update shared collaborative markdown document |
| `DELETE`| `/api/rooms/:id` | Dissolve and permanently purge all room data |

---

## Security & Privacy Discipline

1. **Zero Cold Storage Footprint**: Unstarred files and dissolving rooms strictly purge from disk and database upon expiry.
2. **Defensive Password Protection**: Password verification occurs server-side; protected resources return empty storage paths and sanitized metadata until explicitly unlocked.
3. **No Third-Party Telemetry**: Fileit does not include tracking beacons, advertising tags, or third-party analytical telemetry.
4. **Direct Client WebRTC**: Peer-to-peer data transfers flow point-to-point without relaying raw file bytes through intermediate servers.

---

## License & Copyright

Copyright © 2026 Fileit. All rights reserved.

This software and associated documentation files are private, confidential, and proprietary. Unauthorized copying, distribution, reverse engineering, public exhibition, or modification of any part of this project, via any medium, is strictly prohibited without explicit written authorization from the owner.
