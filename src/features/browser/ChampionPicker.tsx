import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { Champion } from "@/mygo";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { AssetImage } from "./AssetImage";

/** 可搜索的英雄选择器,首项为「全部英雄」 */
export function ChampionPicker({ champions, value, onChange }: { champions: Champion[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = champions.find((c) => c.id === value);
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-36 justify-between gap-2">
          <span className="text-muted-foreground">英雄</span>
          {current && <AssetImage path={current.icon} alt={current.name} className="size-5 rounded-sm" />}
          <span className="truncate">{current?.name ?? "全部"}</span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索英雄名 / 称号 / 英文名…" />
          <CommandList className="max-h-80">
            <CommandEmpty>没有该英雄</CommandEmpty>
            <CommandGroup>
              <CommandItem value="全部英雄" onSelect={() => pick("")}>
                <Check className={cn("size-3.5", !value ? "opacity-100" : "opacity-0")} />
                全部英雄
              </CommandItem>
              {champions.map((c) => (
                <CommandItem key={c.id} value={`${c.name} ${c.title} ${c.id}`} onSelect={() => pick(c.id)} className="gap-2">
                  <Check className={cn("size-3.5", value === c.id ? "opacity-100" : "opacity-0")} />
                  <AssetImage path={c.icon} alt={c.name} className="size-6 shrink-0 rounded-sm" />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">{c.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
