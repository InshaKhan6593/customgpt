"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MoreVertical, Trash2, Flag } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ChatHeaderProps {
  weblet: {
    id: string
    name: string
    iconUrl: string | null
  }
}

export function ChatHeader({ weblet }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b bg-background/95 backdrop-blur z-10 shrink-0">
      <div className="flex items-center space-x-2.5">
        <Avatar className="h-8 w-8">
          <AvatarImage src={weblet.iconUrl || undefined} />
          <AvatarFallback className="text-[11px]">{weblet.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-[13px] font-semibold">{weblet.name}</h2>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Chat
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Flag className="mr-2 h-4 w-4" />
            Report Weblet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
