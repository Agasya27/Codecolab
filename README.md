# CodeCollab

Offline-first collaborative code editor built for a frontend engineering assignment. The app supports live multi-user editing, peer cursors, conflict-safe operational transforms, multi-file workspace management, local-first persistence, and version history.

## Assignment Scope
This project is designed to satisfy the following requirements:

- Real-time collaboration with visible peers and cursors
- Offline-first behavior with queued operations and sync on reconnect
- Conflict resolution for concurrent edits
- Multi-file workspace with persistence
- Version history and restore
- Performance-conscious editing experience for large files

## Tech Stack
- React + TypeScript
- Zustand for global state management
- CodeMirror 6 for editor runtime
- IndexedDB (`idb`) for offline persistence
- Framer Motion for UI transitions and interaction polish
- BroadcastChannel for same-origin tab-to-tab real-time sync

## System Design (Architecture and Scalability)
The app uses a frontend-only architecture with no mandatory backend dependency for collaboration.

### High-level flow
1. UI actions (typing, cursor moves, file operations) dispatch into Zustand state.
2. Local edits are applied immediately for responsive UX.
3. Operations are sent through `SyncManager` over `BroadcastChannel`.
4. Remote tabs receive events and apply transform-safe updates.
5. All file content and snapshots persist to IndexedDB for offline continuity.

### Scalability strategy
- Decoupled modules (`ot/`, `sync/`, `store/`, `db/`) keep responsibilities isolated.
- Event-driven sync layer supports additional transport backends without rewriting editor logic.
- Batched operation dispatch (50ms window) reduces sync overhead during rapid typing.
- Selector-based Zustand subscriptions minimize unnecessary re-renders as workspace size grows.

## State Management (Complex state handling)
State is organized in logical slices within the Zustand store:

- Files slice: `files`, `activeFileId`, create/delete/rename/update actions
- Collaboration slice: `peers`, cursor positions, connectivity, pending ops, revision markers
- Toast slice: join/leave notifications
- History slice: snapshots and restore workflow
- Conflict slice: unresolved merge scenarios and user-driven resolution

Key implementation choices:
- Fine-grained selectors in components to reduce render pressure
- Immutable updates for deterministic state transitions
- Stable ID strategy to separate user identity from tab identity

## Conflict Resolution (Robust merging logic)
The editor uses a custom Operational Transform pipeline:

- Local operations are tracked in a short pending window.
- Incoming remote operations are transformed against local pending ops.
- Successfully transformed ops are applied without interrupting typing.
- Non-transformable/ambiguous scenarios are escalated to a conflict UI path.

This prevents data loss while preserving responsiveness in concurrent edit bursts.

## Performance (Efficiency and optimization)
Performance-focused decisions include:

- CodeMirror 6 for efficient viewport rendering and large text handling
- 50ms op batching in sync manager
- Minimal message payload design for collaboration events
- Snapshot interval policy (10s) for version history without heavy write amplification
- IndexedDB persistence to avoid network dependency and cold-start loss

## Key Features
- Collaborative editing in multiple tabs
- Live peer presence, avatars, and cursor indicators
- Shareable room/session link
- Multi-file workspace creation/deletion/rename
- Auto snapshots + timeline restore
- Light and dark theme support
- Toast notifications for peer join/leave events

## Project Structure
```text
artifacts/collab-editor/
  public/
  src/
    components/
    db/
    hooks/
    ot/
    pages/
    store/
    sync/
    utils/
```

## Getting Started
### Prerequisites
- Node.js 18+
- pnpm 9+

### Install
```bash
pnpm install
```

### Run locally
```bash
pnpm -C artifacts/collab-editor dev
```
Open: `http://localhost:5173`

### Build
```bash
pnpm -C artifacts/collab-editor build
```

### Typecheck
```bash
pnpm -C artifacts/collab-editor typecheck
```

## How to Verify Requirements
1. Real-time collaboration
- Open the same room in two tabs
- Type in one tab and verify mirrored content + cursor movement in the other

2. Offline-first
- Switch one tab offline
- Continue editing
- Reconnect and confirm queued ops flush correctly

3. Conflict handling
- Perform rapid simultaneous edits in two tabs
- Verify transform-safe merge or conflict UI fallback

4. Multi-file workspace
- Create multiple files
- Switch across files and reload to verify IndexedDB persistence

5. Version history
- Wait for auto snapshots
- Open timeline and restore earlier revisions

6. Performance
- Test with larger files and continuous typing
- Confirm smooth interaction and stable UI rendering

## Notes
- Collaboration transport is frontend-native (BroadcastChannel) for same-origin tabs.
- No Firebase/Supabase/CRDT libraries are used.
- Persistence and recovery are fully local-first.

## Submission
Repository includes the implementation and assignment-focused documentation for system design, state management, conflict resolution, and performance.
