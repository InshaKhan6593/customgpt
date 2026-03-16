"use client"

import * as React from "react"
import { CornerUpLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface RollbackButtonProps {
  versionId: string
  versionNum: number
  onRollback: (versionId: string) => void
  disabled?: boolean
}

export function RollbackButton({ versionId, versionNum, onRollback, disabled }: RollbackButtonProps) {
  const [open, setOpen] = React.useState(false)

  const handleConfirm = () => {
    onRollback(versionId)
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground"
        >
          <CornerUpLeft className="size-4 mr-2" />
          Rollback
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rollback to V{versionNum}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately revert the active instructions to version {versionNum}. 
            All new user sessions will use this version. Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Yes, Rollback
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
