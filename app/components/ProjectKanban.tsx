"use client";

import { useRef } from "react";
import { ProjectTaskBoard, Task, TaskStatus } from "@/lib/api";

const DEFAULT_BOARDS: ProjectTaskBoard[] = [
  { id: 0, projectId: 0, statusKey: "TODO", name: "To Do", displayOrder: 10, defaultBoard: true, terminal: false },
  { id: 0, projectId: 0, statusKey: "IN_PROGRESS", name: "In Progress", displayOrder: 20, defaultBoard: true, terminal: false },
  { id: 0, projectId: 0, statusKey: "BLOCKED", name: "Blocked", displayOrder: 30, defaultBoard: true, terminal: false },
  { id: 0, projectId: 0, statusKey: "DONE", name: "Done", displayOrder: 40, defaultBoard: true, terminal: true },
];

const STATUS_DOT: Record<string, string> = {
  TODO: "var(--text-secondary)",
  IN_PROGRESS: "var(--primary-color)",
  BLOCKED: "var(--danger-color)",
  DONE: "var(--success-color)",
};

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntilDue(dueDate: string) {
  const today = new Date(`${todayIsoDate()}T00:00:00`);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function dueWarning(task: Task) {
  if (!task.dueDate || task.status === "DONE") return null;
  const days = daysUntilDue(task.dueDate);
  const priorityRisk = task.priority === "CRITICAL" || task.priority === "HIGH";
  if (days < 0) {
    return { severity: priorityRisk ? "critical" : "danger", label: "Overdue" } as const;
  }
  if (days === 0) {
    return { severity: priorityRisk ? "critical" : "warning", label: "Due today" } as const;
  }
  if (days === 1 || (days <= 3 && priorityRisk)) {
    return { severity: priorityRisk ? "warning" : "notice", label: days === 1 ? "Due tomorrow" : "Due soon" } as const;
  }
  return null;
}

type ProjectKanbanProps = {
  tasks: Task[];
  boards?: ProjectTaskBoard[];
  readOnly?: boolean;
  onTaskDrop?: (taskId: number, status: TaskStatus) => void;
  onTaskSelect?: (task: Task) => void;
  selectedTaskId?: number | null;
  loading?: boolean;
};

export default function ProjectKanban({ tasks, boards = DEFAULT_BOARDS, readOnly = false, onTaskDrop, onTaskSelect, selectedTaskId, loading }: ProjectKanbanProps) {
  const draggedTaskIdRef = useRef<number | null>(null);
  const visibleBoards = boards.length > 0 ? boards : DEFAULT_BOARDS;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px" }} className="text-muted">
        Loading board…
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(Math.max(visibleBoards.length, 1), 5)}, minmax(240px, 1fr))`, gap: "20px", minHeight: "450px", overflowX: "auto", paddingBottom: "6px" }}>
      {visibleBoards.map(board => {
        const status = board.statusKey;
        const boardTasks = tasks.filter(t => t.status === status);
        return (
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
              {board.name}
            </span>
            <span
              style={{
                background: "rgba(255,255,255,0.05)",
                padding: "2px 8px",
                borderRadius: "8px",
                fontSize: "0.7rem",
              }}
            >
              {boardTasks.length}
            </span>
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
            {boardTasks
              .map(task => {
                const warning = dueWarning(task);
                return (
                  <div
                    key={task.id}
                    draggable={!readOnly}
                    onDragStart={readOnly ? undefined : () => { draggedTaskIdRef.current = task.id; }}
                    onDragEnd={readOnly ? undefined : () => { draggedTaskIdRef.current = null; }}
                    onClick={() => onTaskSelect?.(task)}
                    className={`glass-card kanban-task-card ${warning ? `due-${warning.severity}` : ""}`}
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
                    {warning && <span className={`task-inline-warning due-${warning.severity}`}>{warning.label}</span>}
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
                        <span className={`text-xs ${warning ? `task-due due-${warning.severity}` : "text-muted"}`}>
                          {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            {boardTasks.length === 0 && (
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
        );
      })}
    </div>
  );
}
