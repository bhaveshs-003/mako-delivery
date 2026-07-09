/**
 * Seed data (spec §9). Produces a dataset rich enough that every dashboard,
 * chart, and table renders meaningfully on first boot — including a valid,
 * hash-chained audit log written through the real writeAudit engine.
 *
 * Run with:  npx prisma db seed   (Prisma loads .env for you)
 */
import { hashSync } from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { PrismaClient, type UserRole, type ProjectType } from "@prisma/client";
import { writeAudit, verifyAuditChain, type AuditActor } from "../src/lib/audit";
import { calcBurnDays } from "../src/lib/business-days";

const prisma = new PrismaClient();

// "Today" anchor matches the demo environment date.
const NOW = new Date("2026-07-09T10:00:00Z");
const PASSWORD = hashSync("password123", 10);

// ── Lifecycle template stages (spec §2.3 defaults) ──────────────────────────
const TEMPLATES: Record<ProjectType, string[]> = {
  migration: [
    "Source Sheet Received",
    "Mapping Sheet Drafted",
    "RL Clarification Q&A",
    "Sample Migration",
    "Production Checklist Drafted",
    "RL Approval",
    "Production Scripts",
    "Validation",
    "Delta Data Migration",
    "Delta Validation",
    "Final RL Approval",
    "Project Sign-off",
  ],
  integration: [
    "Discovery Call",
    "Scope Draft",
    "RL Scope Lock/Approval",
    "Development",
    "Periodic Demos",
    "Escalation Handling",
    "Change Requests",
    "Final Delivery",
    "Sign-off",
  ],
  custom_app: [
    "Discovery Call",
    "Scope Draft",
    "RL Scope Lock/Approval",
    "Development",
    "Periodic Demos",
    "Escalation Handling",
    "Change Requests",
    "Final Delivery",
    "Sign-off",
  ],
};

function stagesJson(names: string[]) {
  return names.map((name, i) => ({
    name,
    order: i + 1,
    description: "",
    exitCriteria: "",
  }));
}

async function main() {
  console.log("🌱 Seeding Mako Governance Platform…");

  // Clean slate (dev only). Audit log is INSERT-ONLY so we truncate it via a
  // superuser TRUNCATE which bypasses the row-level UPDATE/DELETE triggers.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "meeting_attendees","meetings","comment_versions","comments","attachments",
      "approval_requests","change_requests","dependencies","subtasks","milestones",
      "ticket_projects","tickets","pause_history","notifications",
      "project_rl_consultants","project_resources","projects",
      "lifecycle_templates","sla_configs","users","audit_log"
    RESTART IDENTITY CASCADE;
  `);

  // ── SLA configs ───────────────────────────────────────────────────────────
  const slaByType: Record<string, number> = {
    credential: 3,
    source_sheet: 5,
    approval: 3,
    clarification: 2,
    confirmation: 2,
    other: 5,
  };
  for (const [dependencyType, thresholdDays] of Object.entries(slaByType)) {
    await prisma.slaConfig.create({
      data: { dependencyType: dependencyType as never, thresholdDays, approvalSlaDays: 3 },
    });
  }

  // ── Lifecycle templates ───────────────────────────────────────────────────
  const templateIds: Record<ProjectType, string> = {} as never;
  for (const type of Object.keys(TEMPLATES) as ProjectType[]) {
    const t = await prisma.lifecycleTemplate.create({
      data: { projectType: type, version: 1, isActive: true, stages: stagesJson(TEMPLATES[type]) },
    });
    templateIds[type] = t.id;
  }

  // ── Users: 3 per role ─────────────────────────────────────────────────────
  const userSpecs: { email: string; name: string; role: UserRole }[] = [
    { email: "super@mako.dev", name: "Sarah Chen", role: "super_admin" },
    { email: "super2@mako.dev", name: "David Kim", role: "super_admin" },
    { email: "super3@mako.dev", name: "Elena Ruiz", role: "super_admin" },
    { email: "admin@mako.dev", name: "Michael Torres", role: "admin" },
    { email: "admin2@mako.dev", name: "Nina Kapoor", role: "admin" },
    { email: "admin3@mako.dev", name: "Tom Becker", role: "admin" },
    { email: "priya@mako.dev", name: "Priya Sharma", role: "sub_admin" },
    { email: "sub2@mako.dev", name: "Arjun Mehta", role: "sub_admin" },
    { email: "sub3@mako.dev", name: "Lisa Wong", role: "sub_admin" },
    { email: "john@rocketlane.dev", name: "John Doe", role: "rl_user" },
    { email: "jane@rocketlane.dev", name: "Jane Smith", role: "rl_user" },
    { email: "rl3@rocketlane.dev", name: "Mark Lee", role: "rl_user" },
    { email: "raj@mako.dev", name: "Raj Patel", role: "resource" },
    { email: "res2@mako.dev", name: "Anita Desai", role: "resource" },
    { email: "res3@mako.dev", name: "Carlos Gomez", role: "resource" },
  ];

  const users: Record<string, { id: string; email: string; role: UserRole; name: string }> = {};
  for (const spec of userSpecs) {
    const u = await prisma.user.create({
      data: { email: spec.email, name: spec.name, role: spec.role, passwordHash: PASSWORD, lastLoginAt: subDays(NOW, 1) },
    });
    users[spec.email] = { id: u.id, email: u.email, role: u.role, name: u.name };
  }

  // Deactivate one resource to exercise the "preserved history" path.
  await prisma.user.update({
    where: { email: "res3@mako.dev" },
    data: { isActive: false, deactivatedAt: subDays(NOW, 10), deactivatedBy: users["super@mako.dev"].id },
  });

  const superActor: AuditActor = {
    id: users["super@mako.dev"].id,
    email: users["super@mako.dev"].email,
    role: "super_admin",
    ip: "127.0.0.1",
    sessionId: "seed",
  };

  // ── Projects ──────────────────────────────────────────────────────────────
  const subAdmins = ["priya@mako.dev", "sub2@mako.dev", "sub3@mako.dev"];
  const rlUsers = ["john@rocketlane.dev", "jane@rocketlane.dev", "rl3@rocketlane.dev"];
  const resources = ["raj@mako.dev", "res2@mako.dev", "res3@mako.dev"];

  const projectSpecs = [
    { title: "Alpha Corp Data Migration", type: "migration" as ProjectType, status: "in_progress" as const, deadlineIn: 20, lead: 0 },
    { title: "Beta Industries Legacy Migration", type: "migration" as ProjectType, status: "paused" as const, deadlineIn: 8, lead: 1 },
    { title: "Gamma Retail Salesforce Integration", type: "integration" as ProjectType, status: "in_progress" as const, deadlineIn: 35, lead: 2 },
    { title: "Delta Health API Integration", type: "integration" as ProjectType, status: "completed" as const, deadlineIn: -5, lead: 0 },
    { title: "Epsilon Bank Custom Portal", type: "custom_app" as ProjectType, status: "in_progress" as const, deadlineIn: 45, lead: 1 },
    { title: "Zeta Logistics Custom App", type: "custom_app" as ProjectType, status: "not_started" as const, deadlineIn: 60, lead: 2 },
  ];

  let projIndex = 0;
  for (const spec of projectSpecs) {
    const leadEmail = subAdmins[spec.lead];
    const project = await prisma.project.create({
      data: {
        title: spec.title,
        description: `${spec.title} — delivered by Mako inside the Rocketlane engagement.`,
        type: spec.type,
        status: spec.status,
        rlCommittedDeadline: addDays(NOW, spec.deadlineIn),
        makoInternalDeadline: addDays(NOW, spec.deadlineIn - 5),
        actualCompletionDate: spec.status === "completed" ? subDays(NOW, 5) : null,
        rlProjectId: `RL-${1000 + projIndex}`,
        templateSnapshotId: templateIds[spec.type],
        projectLeadId: users[leadEmail].id,
        createdBy: users["admin@mako.dev"].id,
        rlConsultants: {
          create: [
            { userId: users[rlUsers[projIndex % 3]].id, assignedBy: users["admin@mako.dev"].id },
            { userId: users[rlUsers[(projIndex + 1) % 3]].id, assignedBy: users["admin@mako.dev"].id },
          ],
        },
        resources: {
          create: [
            { userId: users[resources[projIndex % 3]].id, assignedBy: users["admin@mako.dev"].id },
            { userId: users[resources[(projIndex + 1) % 3]].id, assignedBy: users["admin@mako.dev"].id },
          ],
        },
      },
    });

    await writeAudit({
      actor: superActor,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      after: { title: project.title, type: project.type, status: project.status },
      metadata: { seed: true },
    });

    // ── Milestones from the first few template stages ────────────────────────
    const stageNames = TEMPLATES[spec.type].slice(0, 4);
    let mIdx = 0;
    for (const stage of stageNames) {
      const status = mIdx === 0 ? "completed" : mIdx === 1 ? "ongoing" : "yet_to_start";
      const milestone = await prisma.milestone.create({
        data: {
          projectId: project.id,
          parentStage: stage,
          name: stage,
          ownerId: users[resources[projIndex % 3]].id,
          dueDate: addDays(NOW, mIdx * 7 - 3),
          status: status as never,
          approvalStatus: mIdx === 1 ? "pending" : "not_required",
          approvalSlaStartedAt: mIdx === 1 ? subDays(NOW, 4) : null,
          sortOrder: mIdx,
          createdBy: users[leadEmail].id,
          subtasks: {
            create: [
              { title: `${stage} — prep`, assignedToId: users[resources[projIndex % 3]].id, status: "done", createdBy: users[leadEmail].id },
              {
                title: `${stage} — execution`,
                assignedToId: users[resources[projIndex % 3]].id,
                status: mIdx === 1 ? "blocked" : mIdx === 0 ? "done" : "not_started",
                blockedReason: mIdx === 1 ? "Awaiting source-sheet clarification from RL." : null,
                createdBy: users[leadEmail].id,
              },
            ],
          },
        },
      });

      // Approval request on the ongoing, pending-approval milestone.
      if (mIdx === 1) {
        await prisma.approvalRequest.create({
          data: {
            projectId: project.id,
            milestoneId: milestone.id,
            requestedById: users[leadEmail].id,
            requestedAt: subDays(NOW, 4),
            requestComment: `Please review ${stage} output and confirm accuracy.`,
            status: projIndex % 2 === 0 ? "pending" : "approved",
            decidedBy: projIndex % 2 === 0 ? null : users[rlUsers[projIndex % 3]].id,
            decidedAt: projIndex % 2 === 0 ? null : subDays(NOW, 2),
            decisionComment: projIndex % 2 === 0 ? null : "Reviewed and approved.",
            slaDeadline: subDays(NOW, 1),
            slaBreached: projIndex % 2 === 0,
          },
        });
      }
      mIdx++;
    }

    // ── Dependencies (some breached, with root causes) ───────────────────────
    const depDefs = [
      { type: "source_sheet" as const, from: "rl" as const, reqAgo: 12, received: null, sla: 5, rc: "rl" as const },
      { type: "credential" as const, from: "client_via_rl" as const, reqAgo: 9, received: 2, sla: 3, rc: "client_via_rl" as const },
      { type: "clarification" as const, from: "rl" as const, reqAgo: 3, received: 1, sla: 2, rc: null },
    ];
    for (const d of depDefs) {
      const dateRequested = subDays(NOW, d.reqAgo);
      const dateReceived = d.received !== null ? subDays(NOW, d.reqAgo - d.received) : null;
      const burn = calcBurnDays(dateRequested, dateReceived, NOW);
      const breached = burn > d.sla;
      const dep = await prisma.dependency.create({
        data: {
          projectId: project.id,
          type: d.type,
          description: `${d.type.replace("_", " ")} required from ${d.from}`,
          requestedFromParty: d.from,
          dateRequested,
          dateReceived,
          slaThresholdDays: d.sla,
          status: dateReceived ? "received" : "awaiting",
          burnDays: burn,
          slaBreached: breached,
          rootCauseCategory: breached ? d.rc : null,
          rootCauseComment: breached && d.rc ? `${d.rc.toUpperCase()} delay exceeded the agreed SLA.` : null,
          createdBy: users[leadEmail].id,
        },
      });
      if (breached) {
        await writeAudit({
          actor: superActor,
          action: "dependency.sla_breach",
          entityType: "dependency",
          entityId: dep.id,
          after: { burnDays: burn, slaThresholdDays: d.sla, rootCause: d.rc },
          metadata: { projectId: project.id },
        });
      }
    }

    // ── Meetings + MoM (one late, RL-attributed) ─────────────────────────────
    await prisma.meeting.create({
      data: {
        projectId: project.id,
        title: `${spec.title} — Weekly Sync`,
        meetingDate: subDays(NOW, 3),
        organizerId: users[leadEmail].id,
        momStatus: projIndex === 0 ? "late" : "submitted",
        momContent: "<p>Discussed mapping progress and open RL dependencies.</p>",
        momSubmittedAt: subDays(NOW, 2),
        momSubmittedBy: users[leadEmail].id,
        momDeadline: subDays(NOW, 2),
        momLateReasonCategory: projIndex === 0 ? "rl_delay_compressed_timeline" : null,
        momLateReasonComment: projIndex === 0 ? "RL dependency compressed the timeline." : null,
        createdBy: users[leadEmail].id,
      },
    });

    // ── Pause history for the paused project ─────────────────────────────────
    if (spec.status === "paused") {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          currentPauseReasonCategory: "rl",
          currentPauseReasonComment: "Blocked on RL production access approval.",
          pausedAt: subDays(NOW, 6),
        },
      });
      await prisma.pauseHistory.create({
        data: {
          projectId: project.id,
          pausedAt: subDays(NOW, 6),
          resumedAt: null,
          reasonCategory: "rl",
          reasonComment: "Blocked on RL production access approval.",
          pauseDurationDays: calcBurnDays(subDays(NOW, 6), null, NOW),
          pausedBy: users[leadEmail].id,
        },
      });
      await writeAudit({
        actor: superActor,
        action: "project.pause",
        entityType: "project",
        entityId: project.id,
        before: { status: "in_progress" },
        after: { status: "paused", reason: "rl" },
      });
    }

    projIndex++;
  }

  // ── A multi-project API-change ticket (spec §2.8 edge case) ───────────────
  const projects = await prisma.project.findMany({ take: 2, orderBy: { createdAt: "asc" } });
  const ticket = await prisma.ticket.create({
    data: {
      title: "Undocumented API change on /v2/users",
      description: "The /v2/users endpoint now returns a nested 'metadata' object not in the previous schema. Breaks field mapping across linked projects.",
      type: "api_change",
      priority: "high",
      status: "open",
      raisedById: users["priya@mako.dev"].id,
      assignedToId: users["john@rocketlane.dev"].id,
      projectLinks: { create: projects.map((p) => ({ projectId: p.id })) },
    },
  });
  await writeAudit({
    actor: superActor,
    action: "ticket.create",
    entityType: "ticket",
    entityId: ticket.id,
    after: { title: ticket.title, type: ticket.type, linkedProjects: projects.length },
  });

  // ── A change request ──────────────────────────────────────────────────────
  await prisma.changeRequest.create({
    data: {
      projectId: projects[0].id,
      scopeDelta: "Client requires SAML-based SSO not in the original scope.",
      timelineImpactDays: 8,
      effortImpactDescription: "Senior developer for 5 days + QA cycle.",
      status: "pending_rl_approval",
      raisedById: users["priya@mako.dev"].id,
    },
  });

  // Final integrity check.
  const { verifyAuditChain } = await import("../src/lib/audit");
  const result = await verifyAuditChain();

  console.log(`✅ Seed complete.`);
  console.log(`   Users: ${userSpecs.length} · Projects: ${projectSpecs.length}`);
  console.log(`   Audit chain: ${result.ok ? "INTACT" : "BROKEN"} (${result.rowsChecked} rows)`);
  if (!result.ok) console.error("   ⚠️ chain breaks:", result.breaks);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
