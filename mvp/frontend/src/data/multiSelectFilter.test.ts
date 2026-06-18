import { describe, expect, it } from "vitest";
import {
  isMultiSelectAll,
  isMultiSelectNone,
  MULTI_SELECT_NONE,
  multiSelectMatches,
} from "./multiSelectFilter";

describe("multiSelectFilter", () => {
  const options = ["a", "b", "c"];

  it("пустой массив = все", () => {
    expect(multiSelectMatches([], "a")).toBe(true);
    expect(isMultiSelectAll([], options)).toBe(true);
  });

  it("sentinel = ничего", () => {
    expect(multiSelectMatches([MULTI_SELECT_NONE], "a")).toBe(false);
    expect(isMultiSelectNone([MULTI_SELECT_NONE])).toBe(true);
    expect(isMultiSelectAll([MULTI_SELECT_NONE], options)).toBe(false);
  });

  it("частичный выбор", () => {
    expect(multiSelectMatches(["a"], "a")).toBe(true);
    expect(multiSelectMatches(["a"], "b")).toBe(false);
  });
});
