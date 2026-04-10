import { Label } from "@/components/ui/label";

interface ChunkGroupProps {
  title: string;
  items: Array<{
    label: string;
    text: string;
  }>;
}

const ChunkGroup = ({ title, items }: ChunkGroupProps) => {
  if (items.length === 0) return null;

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{title}</Label>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.label}-${item.text}`} className="rounded-[18px] border border-border/80 bg-background/80 p-4">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-sm leading-7 text-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChunkGroup;
