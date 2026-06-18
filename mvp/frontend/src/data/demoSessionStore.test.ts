import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadUserRole } from "./userAccess";
import { scopePrimaryEq } from "./personaAccessScope";
import {
  activePersonaScopeForRole,
  hasDemoSession,
  listLoginPersonaOptions,
  loadDemoPersonaId,
  loginAsDemoPersona,
  resolveDemoPersona,
  writePersonaScopeOverrides,
} from "./demoSessionStore";
import { buildAccessScope } from "./personaAccessScope";

describe("demoSessionStore", () => {
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
    });
  });

  it("assigns different team scopes to Vasya and Petya by default", () => {
    const vasya = resolveDemoPersona("vasya");
    const petya = resolveDemoPersona("petya");
    expect(scopePrimaryEq(vasya.scope!, "team")).toBe("Frontend Web");
    expect(scopePrimaryEq(petya.scope!, "team")).toBe("Mobile");
    expect(scopePrimaryEq(vasya.scope!, "team")).not.toBe(scopePrimaryEq(petya.scope!, "team"));
  });

  it("excludes lead FIO by default for Vasya", () => {
    const vasya = resolveDemoPersona("vasya");
    const neqNames = vasya.scope?.rules
      .filter((rule) => rule.field === "employeeName" && rule.operator === "neq")
      .flatMap((rule) => rule.values);
    expect(neqNames).toContain("Василий Андреев");
  });

  it("loginAsDemoPersona stores session and role", () => {
    expect(hasDemoSession()).toBe(false);
    loginAsDemoPersona("vasya");
    expect(loadDemoPersonaId()).toBe("vasya");
    expect(loadUserRole()).toBe("team_lead");
    expect(hasDemoSession()).toBe(true);
  });

  it("applies C&B scope overrides for named personas", () => {
    writePersonaScopeOverrides({
      vasya: buildAccessScope({
        department: "Engineering",
        unit: "ProductDev",
        team: "Platform",
        excludeEmployeeNames: ["Василий Андреев"],
      }),
    });
    const vasya = resolveDemoPersona("vasya");
    expect(scopePrimaryEq(vasya.scope!, "team")).toBe("Platform");
    loginAsDemoPersona("vasya");
    expect(scopePrimaryEq(activePersonaScopeForRole("team_lead")!, "team")).toBe("Platform");
  });

  it("listLoginPersonaOptions сортирует по ФИО", () => {
    const options = listLoginPersonaOptions();
    expect(options.length).toBe(5);
    expect(options[0].displayName.localeCompare(options[1].displayName, "ru")).toBeLessThanOrEqual(0);
    const vasya = options.find((item) => item.id === "vasya");
    expect(vasya?.optionLabel).toBe("Василий Андреев — Тимлид");
  });

  it("returns persona scope only for matching active role", () => {
    loginAsDemoPersona("sidr");
    expect(scopePrimaryEq(activePersonaScopeForRole("unit_lead")!, "unit")).toBe("ProductDev");
    expect(activePersonaScopeForRole("team_lead")).toBeNull();
  });
});
