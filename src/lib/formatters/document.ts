import type { DocumentParseMethod } from "@/lib/api-types";

export const formatDocumentParseMethodLabel = (parseMethod: DocumentParseMethod) => {
  if (parseMethod === "pdf-text") return "PDF \u6587\u672c";
  if (parseMethod === "plain-text") return "\u7eaf\u6587\u672c";
  if (parseMethod === "image-ocr") return "\u56fe\u7247 OCR";
  return "\u5360\u4f4d\u89e3\u6790";
};
