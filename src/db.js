import Dexie from "dexie";

export class ReFocusDB extends Dexie {
  constructor() {
    super("ReFocusDB");

    this.version(1).stores({
      sessions: "++id, goal, date, canvasTitle",
      settings: "key",
    });
  }
}

export const db = new ReFocusDB();
