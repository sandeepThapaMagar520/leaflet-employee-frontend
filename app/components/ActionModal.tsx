"use client";

type ActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  noteLabel?: string;
  notePlaceholder?: string;
  noteValue?: string;
  noteRequired?: boolean;
  loading?: boolean;
  onNoteChange?: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ActionModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  noteLabel,
  notePlaceholder,
  noteValue = "",
  noteRequired = false,
  loading = false,
  onNoteChange,
  onCancel,
  onConfirm,
}: ActionModalProps) {
  if (!open) return null;

  const confirmDisabled = loading || (noteRequired && noteValue.trim().length === 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "min(460px, 100%)",
          padding: "24px",
          border: tone === "danger" ? "1px solid rgba(239, 68, 68, 0.4)" : undefined,
        }}
      >
        <h2 id="action-modal-title" style={{ fontSize: "1.25rem", marginBottom: "10px" }}>{title}</h2>
        <p className="text-muted text-sm" style={{ marginBottom: noteLabel ? "18px" : "24px", lineHeight: 1.6 }}>
          {description}
        </p>

        {noteLabel && (
          <div style={{ marginBottom: "22px" }}>
            <label className="text-sm text-muted block mb-2">{noteLabel}</label>
            <textarea
              value={noteValue}
              onChange={event => onNoteChange?.(event.target.value)}
              placeholder={notePlaceholder}
              rows={4}
              style={{ width: "100%" }}
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end items-center gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
