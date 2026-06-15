import { describe, expect, it } from "vitest";
import { routerBasename } from "./appBase";

describe("routerBasename", () => {
  it("корень — пустой basename", () => {
    expect(routerBasename()).toBe("");
  });
});
