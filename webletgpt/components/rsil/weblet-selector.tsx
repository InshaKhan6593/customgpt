"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { WebletOverview } from "./types"

interface WebletSelectorProps {
  weblets: WebletOverview[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function WebletSelector({ weblets, selectedId, onSelect }: WebletSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const selected = weblets.find(w => w.id === selectedId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between font-medium"
        >
          {selected ? selected.name : "Select a weblet..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search weblets..." />
          <CommandList>
            <CommandEmpty>No weblet found.</CommandEmpty>
            <CommandGroup>
              {weblets.map((weblet) => (
                <CommandItem
                  key={weblet.id}
                  value={weblet.name}
                  onSelect={() => {
                    onSelect(weblet.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      selectedId === weblet.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {weblet.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
