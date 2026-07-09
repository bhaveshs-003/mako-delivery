import { PhasePlaceholder } from "@/components/shared/PhasePlaceholder";

export default function ApprovalsPage() {
  return (
    <PhasePlaceholder
      title="Pending Approvals"
      phase="Phase 4"
      description="RL approval queue with SLA tracking (no timer restart on reject) and mandatory decision comments."
    />
  );
}
