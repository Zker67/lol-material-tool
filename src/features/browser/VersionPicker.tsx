import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/** 可搜索的版本选择器;allowNone 时首项为「不对比」 */
export function VersionPicker({
  versions,
  value,
  onChange,
  label,
  allowNone,
  noneLabel = "不对比",
  disabledVersion,
}: {
  versions: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabledVersion?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-36 justify-between gap-2 font-mono">
          <span className="text-muted-foreground font-sans">{label}</span>
          <span className="truncate">{value ?? (allowNone ? noneLabel : "—")}</span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索版本…" />
          <CommandList className="max-h-72">
            <CommandEmpty>没有该版本</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem value={noneLabel} onSelect={() => pick(null)}>
                  <Check className={cn("size-3.5", value === null ? "opacity-100" : "opacity-0")} />
                  {noneLabel}
                </CommandItem>
              )}
              {versions.map((v, i) => (
                <CommandItem key={v} value={v} disabled={v === disabledVersion} onSelect={() => pick(v)} className="font-mono">
                  <Check className={cn("size-3.5", value === v ? "opacity-100" : "opacity-0")} />
                  {v}
                  {i === 0 && <span className="ml-auto text-[10px] text-hex-blue font-sans">最新</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
