import { DEFAULT_ORG_TREE, readOrgTree, type OrgTree } from "./orgStructureStore";

/** @deprecated Используйте readOrgTree() — оставлено для сидов и тестов. */
export const ORG_STRUCTURE: OrgTree = DEFAULT_ORG_TREE;

export function getOrgTree(): OrgTree {
  return readOrgTree();
}

export function departmentOptions(): string[] {
  return Object.keys(readOrgTree());
}

export function unitOptions(department: string): string[] {
  return Object.keys(readOrgTree()[department] ?? {});
}

export function teamOptions(department: string, unit: string): string[] {
  return readOrgTree()[department]?.[unit] ?? [];
}
