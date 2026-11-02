import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
  /** 右侧的小字,如数量 */
  hint?: string;
}

/**
 * 筛选用的下拉选择,外观与 VersionPicker / ChampionPicker 一致;首项为「全部」(空值)。
 * 选项多时带搜索框;选中的值不在选项里时(如换了赛季)也列出来,方便清除。
 */
export function OptionPicker({
  label,
  value,
  options,
  onChange,
  searchPlaceholder,
}: {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (v: string) => void;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const list = value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options;
  const current = list.find((o) => o.value === value);
  const searchable = list.length > 8;
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-28 justify-between gap-2">
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate">{current?.label ?? "全部"}</span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={searchPlaceholder ?? `搜索${label}…`} />}
          <CommandList className="max-h-72">
            <CommandEmpty>没有匹配项</CommandEmpty>
            <CommandGroup>
              <CommandItem value="全部" onSelect={() => pick("")}>
                <Check className={cn("size-3.5", !value ? "opacity-100" : "opacity-0")} />
                全部
              </CommandItem>
              {list.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => pick(o.value)}>
                  <Check className={cn("size-3.5", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto text-[11px] text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
