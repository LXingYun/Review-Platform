import { Badge } from "@/components/ui/badge";

interface UploadLeadProps {
  eyebrow: string;
  title: string;
  description: string;
  stepBadge?: string;
}

const UploadLead = ({ eyebrow, title, description, stepBadge }: UploadLeadProps) => (
  <div className="flex flex-col gap-4 rounded-[28px] border border-border/80 bg-card/55 px-5 py-5 md:flex-row md:items-end md:justify-between">
    <div className="space-y-3">
      <span className="eyebrow">{eyebrow}</span>
      <div className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl leading-[1.12] text-foreground md:text-4xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
      </div>
    </div>
    {stepBadge && (
      <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px] tracking-[0.18em] text-muted-foreground">
        {stepBadge}
      </Badge>
    )}
  </div>
);

export default UploadLead;
