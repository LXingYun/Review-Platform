import { describe, expect, it } from "vitest";
import { parseDocumentBuffer } from "../../server/services/document-parse-service";

const parsePlainText = async (text: string) =>
  parseDocumentBuffer({
    originalName: "sample.txt",
    mimeType: "text/plain",
    fileBuffer: Buffer.from(text, "utf8"),
    chunkIdPrefix: "doc-test",
  });

describe("document-parse-service normalization", () => {
  it("removes spaces between han characters", async () => {
    const parsed = await parsePlainText("\u6295\u6807\u4eba\u91d1 \u989d\u586b\u5199");
    expect(parsed.extractedText).toContain("\u6295\u6807\u4eba\u91d1\u989d\u586b\u5199");
  });

  it("keeps spaces between chinese and numbers", async () => {
    const parsed = await parsePlainText("\u91d1\u989d 100 \u4e07\u5143");
    expect(parsed.extractedText).toContain("\u91d1\u989d 100 \u4e07\u5143");
  });

  it("keeps spaces between latin letters and chinese while fixing han-han gaps", async () => {
    const parsed = await parsePlainText("A \u7c7b \u8d44\u8d28");
    expect(parsed.extractedText).toBe("A \u7c7b\u8d44\u8d28");
  });

  it("handles mixed newlines and repeated spaces with han cleanup", async () => {
    const parsed = await parsePlainText("\u4fdd\n  \u8bc1  \n\u91d1  \u6761 \u6b3e");
    expect(parsed.extractedText).toBe("\u4fdd\u8bc1\u91d1\u6761\u6b3e");
  });
});
