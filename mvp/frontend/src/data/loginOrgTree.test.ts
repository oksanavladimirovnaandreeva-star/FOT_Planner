import { describe, expect, it } from "vitest";
import { DEFAULT_ORG_TREE } from "./orgStructureStore";
import { buildLoginOrgTree, loginPathForPersona } from "./loginOrgTree";
import { DEMO_DEPT_IT, DEMO_TEAM_PLATFORM, DEMO_UNIT_A } from "./demoOrg";

describe("buildLoginOrgTree", () => {
  it("кладёт тимлида в департамент → юнит → команду", () => {
    const tree = buildLoginOrgTree(DEFAULT_ORG_TREE);
    const itDept = tree.departments.find((node) => node.department === DEMO_DEPT_IT);
    const unitA = itDept?.units.find((node) => node.unit === DEMO_UNIT_A);
    const platform = unitA?.teams.find((node) => node.team === DEMO_TEAM_PLATFORM);
    expect(platform?.personas.some((persona) => persona.id === "vasya")).toBe(true);
  });

  it("кладёт C&B отдельно от оргдерева", () => {
    const tree = buildLoginOrgTree(DEFAULT_ORG_TREE);
    expect(tree.cbPersonas.map((persona) => persona.id)).toEqual(["cb"]);
    expect(tree.departments.every((dept) => dept.directors.every((persona) => persona.id !== "cb"))).toBe(true);
  });

  it("возвращает путь раскрытия для тимлида", () => {
    const tree = buildLoginOrgTree(DEFAULT_ORG_TREE);
    const path = loginPathForPersona(tree, "vasya");
    expect(path.departmentId).toBe(DEMO_DEPT_IT);
    expect(path.unitId).toContain(DEMO_UNIT_A);
    expect(path.teamId).toContain(DEMO_TEAM_PLATFORM);
  });
});
