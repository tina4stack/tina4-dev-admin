import { describe, expect, it } from "vitest";
import { clarificationQuestion } from "../src/ai-agent";

describe("clarification output from local models", () => {
  it("accepts a question string", () => {
    expect(clarificationQuestion(" What should visitors do? ")).toBe("What should visitors do?");
  });
  it("accepts an array without losing the questions", () => {
    expect(clarificationQuestion(["Who is this for?", "What should it do?"])).toBe("Who is this for?\nWhat should it do?");
  });
  it("extracts questions from labelled objects and rejects unrecognised objects", () => {
    expect(clarificationQuestion([{type:"missing",label:"What is the purpose?"}, {question:"Who will use it?"}])).toBe("What is the purpose?\nWho will use it?");
    expect(clarificationQuestion({unrelated:"data"})).toBe("");
    expect(clarificationQuestion(null)).toBe("");
  });
});
