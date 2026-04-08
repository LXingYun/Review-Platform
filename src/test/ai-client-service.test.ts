import { describe, expect, it } from "vitest";
import { parseStructuredJsonContent } from "../../server/services/ai-client-service";

describe("parseStructuredJsonContent", () => {
  it("parses valid JSON content", () => {
    expect(
      parseStructuredJsonContent<{ findings: string[] }>('{"findings":["ok"]}'),
    ).toEqual({ findings: ["ok"] });
  });

  it("parses JSON wrapped in markdown fences", () => {
    expect(
      parseStructuredJsonContent<{ findings: Array<{ title: string }> }>([
        "```json",
        '{ "findings": [{ "title": "章节问题" }] }',
        "```",
      ].join("\n")),
    ).toEqual({ findings: [{ title: "章节问题" }] });
  });

  it("normalizes smart-quote JSON delimiters", () => {
    expect(
      parseStructuredJsonContent<{ findings: Array<{ title: string; risk: string }> }>([
        "{",
        '  "findings": [',
        "    {",
        '      "title": “人员、设备、资金等方面具有相应的施工能力表述较为原则”,',
        '      "risk": “中”',
        "    }",
        "  ]",
        "}",
      ].join("\n")),
    ).toEqual({
      findings: [
        {
          title: "人员、设备、资金等方面具有相应的施工能力表述较为原则",
          risk: "中",
        },
      ],
    });
  });
});
