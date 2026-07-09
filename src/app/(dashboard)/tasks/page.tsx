import { PhasePlaceholder } from "@/components/shared/PhasePlaceholder";

export default function TasksPage() {
  return (
    <PhasePlaceholder
      title="My Tasks"
      phase="Phase 3"
      description="Kanban board of your assigned subtasks (Not Started · In Progress · Blocked · Done) with drag-to-update and the mandatory blocked-reason flow."
    />
  );
}
