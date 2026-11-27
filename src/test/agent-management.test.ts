import { describe, expect, it } from "vitest";
import { hideAgent, restoreAgent } from "@/lib/sources";

describe("agent visibility", () => {
  it("removes built-in and custom agents without adding duplicate entries", () => {
    const removed = hideAgent(
      hideAgent([], "Bangladesh Intelligence"),
      "My Research Agent",
    );

    expect(removed).toEqual(["Bangladesh Intelligence", "My Research Agent"]);
    expect(hideAgent(removed, "Bangladesh Intelligence")).toEqual(removed);
  });

  it("restores only the selected agent", () => {
    expect(
      restoreAgent(
        ["Bangladesh Intelligence", "Tech & Startup Intelligence"],
        "Bangladesh Intelligence",
      ),
    ).toEqual(["Tech & Startup Intelligence"]);
  });
});