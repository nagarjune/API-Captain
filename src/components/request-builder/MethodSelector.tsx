import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const HTTP_METHODS = [
  { value: 'GET', color: 'text-success' },
  { value: 'POST', color: 'text-info' },
  { value: 'PUT', color: 'text-warning' },
  { value: 'PATCH', color: 'text-warning' },
  { value: 'DELETE', color: 'text-destructive' },
  { value: 'HEAD', color: 'text-muted-foreground' },
  { value: 'OPTIONS', color: 'text-muted-foreground' },
] as const;

interface MethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MethodSelector({ value, onChange }: MethodSelectorProps) {
  const selectedMethod = HTTP_METHODS.find((m) => m.value === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-[120px] font-mono font-semibold", selectedMethod?.color)}>
        <SelectValue placeholder="Method" />
      </SelectTrigger>
      <SelectContent>
        {HTTP_METHODS.map((method) => (
          <SelectItem
            key={method.value}
            value={method.value}
            className={cn("font-mono font-semibold", method.color)}
          >
            {method.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
