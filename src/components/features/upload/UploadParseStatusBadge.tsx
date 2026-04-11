import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DocumentItem } from "@/lib/api-types";

interface UploadParseStatusBadgeProps {
  status: DocumentItem["parseStatus"];
}

const UploadParseStatusBadge = ({ status }: UploadParseStatusBadgeProps) => {
  if (status === "待解析") {
    return (
      <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        待解析
      </Badge>
    );
  }

  if (status === "解析中") {
    return (
      <Badge variant="secondary" className="shrink-0 whitespace-nowrap border-warning/20 bg-warning/10 text-warning">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        解析中
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="shrink-0 whitespace-nowrap border-success/20 bg-success/10 text-success">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      已完成
    </Badge>
  );
};

export default UploadParseStatusBadge;
