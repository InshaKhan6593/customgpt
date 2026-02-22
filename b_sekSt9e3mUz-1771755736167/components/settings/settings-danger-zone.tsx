"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

export function SettingsDangerZone() {
  const [confirmText, setConfirmText] = useState("")
  const [open, setOpen] = useState(false)

  const handleDelete = () => {
    // Placeholder: call DELETE /api/account
    setOpen(false)
    setConfirmText("")
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-foreground">Danger Zone</CardTitle>
        <CardDescription>Irreversible actions for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="size-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex flex-col gap-2">
            <p className="font-medium text-foreground">Delete Account</p>
            <p className="text-sm text-muted-foreground">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText("") }}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-fit mt-2">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete your account and remove all of your data.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-4">
                  <Label htmlFor="confirm-delete">
                    Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={confirmText !== "DELETE"}
                    onClick={handleDelete}
                  >
                    Permanently Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
