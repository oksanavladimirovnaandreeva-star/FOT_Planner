import { describe, expect, it } from "vitest";
import { defaultVersionLabel } from "./planVersions";

describe("planVersions labels", () => {
  it("формирует имя версии в формате бюджет/версия/квартал", () => {
    expect(defaultVersionLabel(2026, 1)).toBe("Бюджет 2026 · Версия 1 · 1 квартал 2026");
    expect(defaultVersionLabel(2026, 2)).toBe("Бюджет 2026 · Версия 2 · 2 квартал 2026");
  });
});
