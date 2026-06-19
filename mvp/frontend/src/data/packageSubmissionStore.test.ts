import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPackageSubmissionAction,
  getPackageSubmission,
  PACKAGE_PHASE_LABELS,
} from "./packageSubmissionStore";

describe("packageSubmissionStore", () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => {
        memory.clear();
      },
    });
  });

  it("unit_lead отправляет пакет юнита директору", () => {
    const result = applyPackageSubmissionAction({
      planVersionId: "d1",
      level: "unit",
      department: "Engineering",
      unit: "ProductDev",
      action: "package_submit_unit",
      actorRole: "unit_lead",
    });
    expect(result.ok).toBe(true);
    const record = getPackageSubmission({
      planVersionId: "d1",
      level: "unit",
      department: "Engineering",
      unit: "ProductDev",
    });
    expect(record?.phase).toBe("submitted");
    expect(PACKAGE_PHASE_LABELS.submitted).toContain("Отправлено");
  });

  it("director согласует пакет юнита", () => {
    applyPackageSubmissionAction({
      planVersionId: "d1",
      level: "unit",
      department: "Engineering",
      unit: "ProductDev",
      action: "package_submit_unit",
      actorRole: "unit_lead",
    });
    const result = applyPackageSubmissionAction({
      planVersionId: "d1",
      level: "unit",
      department: "Engineering",
      unit: "ProductDev",
      action: "package_approve_unit",
      actorRole: "director",
    });
    expect(result.ok).toBe(true);
    const record = getPackageSubmission({
      planVersionId: "d1",
      level: "unit",
      department: "Engineering",
      unit: "ProductDev",
    });
    expect(record?.phase).toBe("approved");
  });
});
