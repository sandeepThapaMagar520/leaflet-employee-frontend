"use client";

import { useMemo, useState } from "react";

export type MentionCandidate = {
  id: number;
  fullName: string;
};

type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  candidates: MentionCandidate[];
  rows?: number;
  placeholder?: string;
};

function currentMentionToken(value: string) {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1].toLowerCase() : null;
}

export function mentionedUserIdsFromText(value: string, candidates: MentionCandidate[]) {
  const lower = value.toLowerCase();
  return candidates
    .filter(candidate => lower.includes(`@${candidate.fullName.toLowerCase()}`))
    .map(candidate => candidate.id);
}

export default function MentionTextarea({ value, onChange, candidates, rows = 4, placeholder }: MentionTextareaProps) {
  const [focused, setFocused] = useState(false);
  const token = currentMentionToken(value);
  const suggestions = useMemo(() => {
    if (token === null) return [];
    return candidates
      .filter(candidate => candidate.fullName.toLowerCase().includes(token))
      .slice(0, 6);
  }, [candidates, token]);

  function insertMention(candidate: MentionCandidate) {
    const next = value.replace(/(?:^|\s)@([^\s@]*)$/, match => {
      const prefix = match.startsWith(" ") ? " " : "";
      return `${prefix}@${candidate.fullName} `;
    });
    onChange(next);
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        rows={rows}
        placeholder={placeholder}
        style={{ width: "100%" }}
      />
      {focused && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            bottom: "calc(100% + 6px)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            background: "rgba(15, 23, 42, 0.98)",
            boxShadow: "0 16px 32px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          {suggestions.map(candidate => (
            <button
              key={candidate.id}
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                insertMention(candidate);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                textAlign: "left",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              @{candidate.fullName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
