"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAllTasks,
  deleteTask,
  getMyTasks,
  updateTaskStatus,
  getProjectTaskBoards,
  ProjectTaskBoard,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import ActionModal from "@/app/components/ActionModal";

const defaultTaskBoards: ProjectTaskBoard[] = [
  { id: 0, projectId: 0, statusKey: "TODO", name: "To Do", displayOrder: 10, defaultBoard: true, terminal: false },
  { id: 0, projectId: 0, statusKey: "IN_PROGRESS", name: "In Progress", displayOrder: 20, defaultBoard: true, terminal: false },
  { id: 0, projectId: 0, statusKey: "BLOCKED", name: "Blocked", displayOrder: 30, defaultBoard: true, terminal: false },
  { id: 0, projectId: 0, statusKey: "DONE", name: "Done", displayOrder: 40, defaultBoard: true, terminal: true },
];

const defaultStatusOptions: TaskStatus[] = defaultTaskBoards.map(board => board.statusKey);
const priorityOptions: Array<TaskPriority | "ALL"> = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

function getBoardOptions(projectId: number, boardsByProject: Record<number, ProjectTaskBoard[]>) {
  return boardsByProject[projectId]?.length ? boardsByProject[projectId] : defaultTaskBoards;
}

function getStatusLabel(status: string, boards?: ProjectTaskBoard[]) {
  return boards?.find(board => board.statusKey === status)?.name ?? status.replaceAll("_", " ");
}

async function loadBoardsByProject(tasks: Task[]) {
  const projectIds = Array.from(new Set(tasks.map(task => task.projectId)));
  const entries = await Promise.all(
    projectIds.map(async projectId => {
      try {
        return [projectId, await getProjectTaskBoards(projectId)] as const;
      } catch {
        return [projectId, defaultTaskBoards] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

function getStatusBadgeClass(status: string) {
  if (status === "TODO") return "badge-todo";
  if (status === "IN_PROGRESS") return "badge-in-progress";
  if (status === "DONE") return "badge-done";
  if (status === "BLOCKED") return "badge-blocked";
  return "";
}

function priorityClass(priority: TaskPriority) {
  return `task-priority task-priority-${priority.toLowerCase()}`;
}

function initials(name?: string | null) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "DONE") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate) < today;
}

function summary(tasks: Task[]) {
  return {
    total: tasks.length,
    active: tasks.filter(task => task.status !== "DONE").length,
    completed: tasks.filter(task => task.status === "DONE").length,
    overdue: tasks.filter(isOverdue).length,
  };
}

function TaskSummaryStrip({ tasks }: { tasks: Task[] }) {
  const stats = summary(tasks);
  return (
    <div className="task-summary-strip">
      <div>
        <span>Total</span>
        <strong>{stats.total}</strong>
      </div>
      <div>
        <span>Active</span>
        <strong>{stats.active}</strong>
      </div>
      <div>
        <span>Overdue</span>
        <strong>{stats.overdue}</strong>
      </div>
      <div>
        <span>Completed</span>
        <strong>{stats.completed}</strong>
      </div>
    </div>
  );
}

function EmptyTasks({ title, body }: { title: string; body: string }) {
  return (
    <div className="task-empty-state">
      <div className="task-empty-mark">0</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function EmployeeTasksPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading } = useAuth(["EMPLOYEE"]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [boardsByProject, setBoardsByProject] = useState<Record<number, ProjectTaskBoard[]>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const loadedTasks = await getMyTasks();
      setTasks(loadedTasks);
      setBoardsByProject(await loadBoardsByProject(loadedTasks));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) void loadData();
  }, [authLoading, loadData]);

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    try {
      await updateTaskStatus(taskId, status);
      await loadData();
      toast.success("Task status updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  if (authLoading || loading) return <div className="p-8">Loading tasks...</div>;

  const filteredTasks = tasks.filter(task => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      task.title.toLowerCase().includes(query) ||
      task.projectName?.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const allBoards = Object.values(boardsByProject).flat();
  const filterOptions = Array.from(new Set([
    ...defaultStatusOptions,
    ...allBoards.map(board => board.statusKey),
    ...tasks.map(task => task.status),
  ]));

  return (
    <div className="task-page">
      <div className="task-page-header">
        <div>
          <p className="task-eyebrow">Personal workload</p>
          <h1>My Tasks</h1>
          <p>Review your assigned work, jump back into projects, and update progress without hunting through boards.</p>
        </div>
      </div>

      <TaskSummaryStrip tasks={tasks} />

      <div className="task-filter-bar">
        <div className="task-search-field">
          <span>Search</span>
          <input
            type="text"
            placeholder="Task title or project"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />
        </div>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {filterOptions.map(status => (
              <option key={status} value={status}>{getStatusLabel(status, allBoards)}</option>
            ))}
          </select>
        </label>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyTasks title="No tasks found" body="Try changing the search or status filter." />
      ) : (
        <div className="employee-task-grid">
          {filteredTasks.map(task => {
            const boards = getBoardOptions(task.projectId, boardsByProject);
            return (
              <article key={task.id} className={`task-work-card ${isOverdue(task) ? "is-overdue" : ""}`}>
                <div className="task-card-top">
                  <span className={priorityClass(task.priority)}>{task.priority}</span>
                  <span className={`badge ${getStatusBadgeClass(task.status)}`}>
                    {getStatusLabel(task.status, boards)}
                  </span>
                </div>
                <h2>{task.title}</h2>
                {task.description && <p className="task-description">{task.description}</p>}
                <button
                  type="button"
                  className="task-project-link"
                  onClick={() => router.push(`/projects/${task.projectId}`)}
                >
                  {task.projectName}
                </button>
                <div className="task-card-meta">
                  <span className={isOverdue(task) ? "task-due overdue" : "task-due"}>{formatDate(task.dueDate)}</span>
                  <select
                    value={task.status}
                    onChange={event => void handleStatusChange(task.id, event.target.value as TaskStatus)}
                    aria-label={`Update ${task.title} status`}
                  >
                    {boards.map(board => (
                      <option key={board.statusKey} value={board.statusKey}>{board.name}</option>
                    ))}
                  </select>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminTasksPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading } = useAuth(["ADMIN", "MANAGER"]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Array<TaskPriority | "ALL">[number]>("ALL");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await getAllTasks());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) void loadData();
  }, [authLoading, loadData]);

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTask(deleteTarget.id);
      toast.success("Task deleted successfully");
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  }

  const filteredTasks = tasks.filter(task => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      task.title.toLowerCase().includes(query) ||
      task.projectName?.toLowerCase().includes(query) ||
      task.assignedToName?.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "ALL" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });
  const adminFilterOptions = Array.from(new Set([...defaultStatusOptions, ...tasks.map(task => task.status)]));

  if (loading) {
    return (
      <div className="task-loading-state">
        <div className="animate-pulse text-muted">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="task-page">
      <div className="task-page-header">
        <div>
          <p className="task-eyebrow">Team operations</p>
          <h1>Task Management</h1>
          <p>Scan ownership, priority, and risk across active project work.</p>
        </div>
        <button onClick={() => router.push("/tasks/new")} className="btn-primary">New Task</button>
      </div>

      <TaskSummaryStrip tasks={tasks} />

      <div className="task-filter-bar">
        <div className="task-search-field">
          <span>Search</span>
          <input
            type="text"
            placeholder="Title, project, or assignee"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />
        </div>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {adminFilterOptions.map(status => (
              <option key={status} value={status}>{getStatusLabel(status, defaultTaskBoards)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as typeof priorityFilter)}>
            {priorityOptions.map(priority => (
              <option key={priority} value={priority}>{priority === "ALL" ? "All priorities" : priority}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="task-table-shell">
        <div className="task-table-header">
          <span>{filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}</span>
          <span>{summary(filteredTasks).overdue} overdue</span>
        </div>
        {filteredTasks.length === 0 ? (
          <EmptyTasks title="No matching tasks" body="Clear a filter or search for another project, assignee, or task title." />
        ) : (
          <table className="task-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                    {task.description && <small>{task.description}</small>}
                  </td>
                  <td>
                    <button type="button" onClick={() => router.push(`/projects/${task.projectId}`)}>
                      {task.projectName}
                    </button>
                  </td>
                  <td>
                    <div className="task-owner">
                      <span>{initials(task.assignedToName)}</span>
                      <strong>{task.assignedToName}</strong>
                    </div>
                  </td>
                  <td><span className={isOverdue(task) ? "task-due overdue" : "task-due"}>{formatDate(task.dueDate)}</span></td>
                  <td><span className={priorityClass(task.priority)}>{task.priority}</span></td>
                  <td><span className={`badge ${getStatusBadgeClass(task.status)}`}>{getStatusLabel(task.status, defaultTaskBoards)}</span></td>
                  <td>
                    <button onClick={() => setDeleteTarget(task)} className="task-row-delete">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ActionModal
        open={deleteTarget !== null}
        title="Delete Task"
        description={`This will permanently delete "${deleteTarget?.title ?? "this task"}" from ${deleteTarget?.projectName ?? "the project"}.`}
        confirmLabel="Delete Task"
        tone="danger"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export default function TasksPage() {
  const { loading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);

  if (loading) return <div className="p-8">Verifying access...</div>;
  if (user?.role === "EMPLOYEE") return <EmployeeTasksPage />;
  return <AdminTasksPage />;
}
