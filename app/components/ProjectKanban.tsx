"use client";

import { useRef } from "react";
import { Task, TaskStatus } from "@/lib/api";

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

const STATUS_DOT: Record<TaskStatus, string> = {
  TODO: "var(--text-secondary)",
  IN_PROGRESS: "var(--primary-color)",
  BLOCKED: "var(--danger-color)",
  DONE: "var(--success-color)",
};

type ProjectKanbanProps = {
  tasks: Task[];
  readOnly?: boolean;
  onTaskDrop?: (taskId: number, status: TaskStatus) => void;
  onTaskSelect?: (task: Task) => void;
  selectedTaskId?: number | null;
  loading?: boolean;
};

export default function ProjectKanban({ tasks, readOnly = false, onTaskDrop, onTaskSelect, selectedTaskId, loading }: ProjectKanbanProps) {
  const draggedTaskIdRef = useRef<number | null>(null);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px" }} className="text-muted">
        Loading board…
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px", minHeight: "450px" }}>
      {COLUMNS.map(status => (
        <div
          key={status}
          onDragOver={readOnly ? undefined : e => e.preventDefault()}
          onDrop={
            readOnly
              ? undefined
              : () => {
                  const id = draggedTaskIdRef.current;
                  if (id != null && onTaskDrop) onTaskDrop(id, status);
                }
          }
          style={{
            background: "rgba(0,0,0,0.15)",
            borderRadius: "8px",
            padding: "16px",
            border: "1px solid rgba(255,255,255,0.03)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h4
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              padding: "0 4px",
            }}
          >
            <span className="flex items-center gap-2">
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: STATUS_DOT[status],
                }}
              />
              {status.replace("_", " ")}
            </span>
            <span
              style={{
                background: "rgba(255,255,255,0.05)",
                padding: "2px 8px",
                borderRadius: "8px",
                fontSize: "0.7rem",
              }}
            >
              {tasks.filter(t => t.status === status).length}
            </span>
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
            {tasks
              .filter(t => t.status === status)
              .map(task => (
                <div
                  key={task.id}
                  draggable={!readOnly}
                  onDragStart={readOnly ? undefined : () => { draggedTaskIdRef.current = task.id; }}
                  onDragEnd={readOnly ? undefined : () => { draggedTaskIdRef.current = null; }}
                  onClick={() => onTaskSelect?.(task)}
                  className="glass-card"
                  style={{
                    padding: "14px",
                    fontSize: "0.9rem",
                    background: "rgba(30,41,59,0.5)",
                    cursor: onTaskSelect ? "pointer" : readOnly ? "default" : "grab",
                    outline: selectedTaskId === task.id ? "2px solid var(--primary-color)" : "none",
                    borderLeft: `4px solid ${
                      task.priority === "CRITICAL"
                        ? "var(--danger-color)"
                        : task.priority === "HIGH"
                          ? "#fb923c"
                          : task.priority === "MEDIUM"
                            ? "var(--primary-color)"
                            : "var(--text-secondary)"
                    }`,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "8px", lineHeight: 1.4 }}>{task.title}</div>
                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-1">
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "var(--accent-color)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.6rem",
                          fontWeight: 700,
                        }}
                      >
                        {task.assignedToName?.split(" ").map(n => n[0]).join("") || "U"}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {task.assignedToName}
                      </span>
                    </div>
                    {task.dueDate && (
                      <span className="text-xs text-muted">
                        {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            {tasks.filter(t => t.status === status).length === 0 && (
              <div
                style={{
                  flex: 1,
                  border: "1px dashed rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.1)",
                  fontSize: "0.8rem",
                }}
              >
                Empty
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
