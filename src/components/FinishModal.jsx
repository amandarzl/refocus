import { useRef, useState } from "react";
import { compressImage, revokeObjectUrl } from "../utils/imageProcessor";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import EmptyTile from "./ui/EmptyTile.jsx";

export default function FinishModal({ session, onClose, onSave }) {
  const [image, setImage] = useState(null);
  const [palette, setPalette] = useState([]);
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const result = await compressImage(file, {
      extractPalette: true, // Always extract palette for drawing snapshots
      preferWorker: true,
    });

    if (!result.success) {
      console.error("Compression failed:", result.error);
      return;
    }

    const blobUrl = URL.createObjectURL(result.blob);
    setImage(blobUrl);
    if (result.palette && result.palette.length > 0) {
      setPalette(result.palette);
    }
  };

  const handleSave = async () => {
    const sessionData = {
      id: session?.id || Date.now(),
      image,
      palette,
      notes,
      date: new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    };
    await onSave(sessionData);
    // Revoke blob URL after parent has converted it to base64
    if (image && image.startsWith("blob:")) {
      revokeObjectUrl(image);
    }
    setImage(null);
    setPalette([]);
  };

  return (
    <Modal onClose={onClose} maxWidth="lg" labelledBy="finish-modal-title">
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 id="finish-modal-title" className="text-xl font-bold tracking-tight text-ink-primary">
              Finish Drawing
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">Review your work before saving to the vault.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-control p-2 text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            title="Close"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {/* Drawing Snapshot Upload */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-muted">Drawing Snapshot</label>
            {image ? (
              <div className="relative overflow-hidden rounded-panel">
                <img src={image} alt="Drawing snapshot preview" className="h-48 w-full object-cover" />
                <button
                  onClick={() => {
                    if (image) revokeObjectUrl(image);
                    setImage(null);
                    setPalette([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 rounded-control bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                  title="Remove snapshot"
                  aria-label="Remove snapshot"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <EmptyTile size="wide" onClick={() => fileInputRef.current?.click()} className="!p-0 h-48">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                <span className="text-sm font-medium">Upload drawing snapshot</span>
              </EmptyTile>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Review Notes */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-muted">Review Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this session..."
              className="w-full resize-none rounded-panel border border-border bg-surface-sunken px-4 py-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition-colors focus:border-accent-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1 justify-center py-3">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} className="flex-1 justify-center py-3 shadow-card">
              Save to Vault & Return to Hub
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
