import { monthLabel } from "./planningData";
import type { PlannedEvent, PositionRecord } from "../types";

export const APPROVAL_RULE_DEFINITIONS = [
  {
    id: "transfer-inter",
    title: "Перевод в другой департамент",
    route: "Согласование HR + целевой unit-lead",
  },
  {
    id: "over-limit",
    title: "Новая позиция сверх лимита",
    route: "Согласование финансового контролёра",
  },
  {
    id: "indexation-mass",
    title: "Массовая индексация > 5%",
    route: "Согласование HR-директора",
  },
  {
    id: "headcount-down",
    title: "Сокращение позиции",
    route: "Согласование HR + unit-lead",
  },
] as const;

export type ApprovalRuleId = (typeof APPROVAL_RULE_DEFINITIONS)[number]["id"];

export interface ApprovalRuleMatch {
  positionId: string;
  eventId?: string;
  summary: string;
}

export interface TriggeredApprovalRule {
  id: ApprovalRuleId;
  title: string;
  route: string;
  matches: ApprovalRuleMatch[];
}

export interface DraftApprovalCheck {
  triggered: TriggeredApprovalRule[];
  /** Правила, не сработавшие в черновике относительно базы. */
  clear: (typeof APPROVAL_RULE_DEFINITIONS)[number][];
}

const MASS_INDEXATION_MIN_POSITIONS = 2;
const MASS_INDEXATION_PERCENT_THRESHOLD = 5;

function baselineEventIds(baselinePositions: PositionRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const position of baselinePositions) {
    for (const event of position.events) {
      ids.add(event.id);
    }
  }
  return ids;
}

/** События, добавленные в черновике (по id) или все события новых позиций. */
export function collectDraftDeltaEvents(
  baselinePositions: PositionRecord[],
  draftPositions: PositionRecord[],
): { position: PositionRecord; event: PlannedEvent }[] {
  const knownIds = baselineEventIds(baselinePositions);
  const baselinePositionIds = new Set(baselinePositions.map((position) => position.positionId));
  const delta: { position: PositionRecord; event: PlannedEvent }[] = [];

  for (const position of draftPositions) {
    const isNewPosition = !baselinePositionIds.has(position.positionId);
    for (const event of position.events) {
      if (isNewPosition || !knownIds.has(event.id)) {
        delta.push({ position, event });
      }
    }
  }
  return delta;
}

function ruleDefinition(id: ApprovalRuleId) {
  return APPROVAL_RULE_DEFINITIONS.find((rule) => rule.id === id)!;
}

function isInterDepartmentTransfer(event: PlannedEvent, source: PositionRecord): boolean {
  if (event.type !== "TRANSFER") return false;
  if (event.payload.transferKind === "INTER_DEPARTMENT") return true;
  const targetDept = event.payload.targetDepartment?.trim();
  return Boolean(targetDept && targetDept !== source.department.trim());
}

export function evaluateDraftApprovalRules(
  baselinePositions: PositionRecord[],
  draftPositions: PositionRecord[],
): DraftApprovalCheck {
  const delta = collectDraftDeltaEvents(baselinePositions, draftPositions);
  const baselineById = new Map(baselinePositions.map((position) => [position.positionId, position] as const));
  const draftById = new Map(draftPositions.map((position) => [position.positionId, position] as const));

  const triggeredMap = new Map<ApprovalRuleId, ApprovalRuleMatch[]>();

  const pushMatch = (ruleId: ApprovalRuleId, match: ApprovalRuleMatch) => {
    const list = triggeredMap.get(ruleId) ?? [];
    list.push(match);
    triggeredMap.set(ruleId, list);
  };

  for (const { position, event } of delta) {
    if (isInterDepartmentTransfer(event, position)) {
      const target =
        event.payload.targetDepartment && event.payload.targetUnit
          ? `${event.payload.targetDepartment} / ${event.payload.targetUnit}`
          : event.payload.targetDepartment ?? "другой департамент";
      pushMatch("transfer-inter", {
        positionId: position.positionId,
        eventId: event.id,
        summary: `${position.positionId}: перевод в ${target} с ${monthLabel(event.payload.month)}`,
      });
    }

    if (event.type === "CLOSE_POSITION") {
      pushMatch("headcount-down", {
        positionId: position.positionId,
        eventId: event.id,
        summary: `${position.positionId}: сокращение с ${monthLabel(event.payload.month)}`,
      });
    }
  }

  for (const [positionId, draft] of draftById) {
    if (baselineById.has(positionId)) continue;
    if (draft.limitFlag !== "OVER_LIMIT") continue;
    pushMatch("over-limit", {
      positionId,
      summary: `${positionId}: новая позиция · ${draft.limitFlag === "OVER_LIMIT" ? "сверх лимита" : draft.limitFlag}`,
    });
  }

  const indexationByBatch = new Map<string, { percent: number; positionIds: Set<string> }>();
  for (const { position, event } of delta) {
    if (event.type !== "INDEXATION") continue;
    const percent = event.payload.percent ?? 0;
    if (percent <= MASS_INDEXATION_PERCENT_THRESHOLD) continue;
    const batchId = event.payload.indexationBatchId ?? event.id;
    const entry = indexationByBatch.get(batchId) ?? { percent, positionIds: new Set<string>() };
    entry.percent = Math.max(entry.percent, percent);
    entry.positionIds.add(position.positionId);
    indexationByBatch.set(batchId, entry);
  }

  for (const [batchId, batch] of indexationByBatch) {
    if (batch.positionIds.size < MASS_INDEXATION_MIN_POSITIONS) continue;
    pushMatch("indexation-mass", {
      positionId: [...batch.positionIds][0],
      summary: `Индексация +${batch.percent}% · ${batch.positionIds.size} поз. (пакет ${batchId.slice(0, 8)}…)`,
    });
  }

  const triggered: TriggeredApprovalRule[] = [];
  for (const [id, matches] of triggeredMap) {
    const def = ruleDefinition(id);
    triggered.push({ id, title: def.title, route: def.route, matches });
  }

  triggered.sort((a, b) => APPROVAL_RULE_DEFINITIONS.findIndex((r) => r.id === a.id) - APPROVAL_RULE_DEFINITIONS.findIndex((r) => r.id === b.id));

  const triggeredIds = new Set(triggered.map((rule) => rule.id));
  const clear = APPROVAL_RULE_DEFINITIONS.filter((rule) => !triggeredIds.has(rule.id));

  return { triggered, clear };
}

export function formatApprovalSubmitConfirm(check: DraftApprovalCheck): string | null {
  if (check.triggered.length === 0) return null;
  const lines = check.triggered.map(
    (rule) => `• ${rule.title} (${rule.matches.length}) → ${rule.route}`,
  );
  return [
    "В черновике есть изменения, требующие дополнительного согласования:",
    "",
    ...lines,
    "",
    "Отправить черновик на согласование?",
  ].join("\n");
}

export function validateDraftForApproval(
  draftPositions: PositionRecord[],
): { ok: true } | { ok: false; error: string } {
  if (!draftPositions.length) {
    return { ok: false, error: "В черновике нет позиций для отправки." };
  }
  return { ok: true };
}
