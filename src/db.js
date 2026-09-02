import Dexie from "dexie";

// Starter folders seeded for every fresh install, and used to remap
// pre-v3 data (see the v3 upgrade below). Kept here so both paths — the
// upgrade function and the app-level "seed if empty" check in
// ReferenceBoard.jsx — agree on the same starting set.
export const DEFAULT_FOLDER_NAMES = ["Form", "Pose", "Color", "Vibe"];

export class ReFocusDB extends Dexie {
  constructor() {
    super("ReFocusDB");

    this.version(1).stores({
      sessions: "++id, goal, date, canvasTitle",
      settings: "key",
    });

    // v2: persistent, tag-filterable reference library keyed by a fixed
    // category string (superseded by v3's user-manageable folders).
    this.version(2).stores({
      sessions: "++id, goal, date, canvasTitle",
      settings: "key",
      references: "++id, category, createdAt, *tags",
    });

    // v3: Reference Board — categories become user-manageable folders.
    // References now key off a numeric folderId instead of a fixed
    // category string. Existing v2 references are remapped onto freshly
    // created default folders; brand-new installs get an empty `folders`
    // table (seeded at the app level — see ReferenceBoard.jsx — since
    // Dexie doesn't run upgrade() for databases that never existed).
    this.version(3)
      .stores({
        sessions: "++id, goal, date, canvasTitle",
        settings: "key",
        references: "++id, folderId, createdAt, *tags",
        folders: "++id, order, createdAt",
      })
      .upgrade(async (tx) => {
        const nameToId = {};
        for (let i = 0; i < DEFAULT_FOLDER_NAMES.length; i++) {
          const name = DEFAULT_FOLDER_NAMES[i];
          const id = await tx.table("folders").add({
            name,
            order: i,
            createdAt: Date.now(),
          });
          nameToId[name.toLowerCase()] = id;
        }
        await tx
          .table("references")
          .toCollection()
          .modify((ref) => {
            const key = (ref.category || "").toLowerCase();
            ref.folderId = nameToId[key] ?? nameToId[DEFAULT_FOLDER_NAMES[0].toLowerCase()];
            delete ref.category;
          });
      });

    // v4: folders gain an `isDefault` flag. Only default folders (and
    // folders the user has explicitly attached to a board — tracked in
    // each session's canvasState, not here) show up as Reference Board
    // slots automatically; everything else lives only in the Add
    // References library until manually added. Marks the v3-created
    // starter folders (and any same-named ones) as default so existing
    // installs keep seeing them on the board after this upgrade.
    this.version(4)
      .stores({
        sessions: "++id, goal, date, canvasTitle",
        settings: "key",
        references: "++id, folderId, createdAt, *tags",
        folders: "++id, order, createdAt",
      })
      .upgrade(async (tx) => {
        const defaultNames = new Set(DEFAULT_FOLDER_NAMES.map((n) => n.toLowerCase()));
        await tx
          .table("folders")
          .toCollection()
          .modify((folder) => {
            if (defaultNames.has((folder.name || "").toLowerCase())) {
              folder.isDefault = true;
            }
          });
      });
  }
}

export const db = new ReFocusDB();
