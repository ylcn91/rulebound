"use client"

import { useState } from "react"
import { User as UserIcon, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { User } from "@/lib/user-utils"

interface UserCardProps {
  user: User
  onDelete?: (userId: string) => void
  className?: string
}

export function UserCard({ user, onDelete, className }: UserCardProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  function handleDelete() {
    // TODO: Implement delete behavior
    // Consider: Should this require confirmation? Immediate delete?
    // What feedback should the user see?
  }

  return (
    <Card className={cn("transition-colors duration-200 hover:border-(--color-text-primary)/30", className)}>
      <CardContent className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--color-grid) border border-(--color-border)">
            <UserIcon className="h-5 w-5 text-(--color-muted)" />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-(--color-text-primary)">
              {user.name}
            </p>
            <p className="text-xs text-(--color-text-secondary)">
              {user.email}
            </p>
          </div>
        </div>

        {onDelete && (
          <div className="flex items-center gap-2">
            {isConfirming ? (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfirming(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConfirming(true)}
                aria-label={`Delete ${user.name}`}
              >
                <Trash2 className="h-4 w-4 text-(--color-text-secondary) hover:text-(--color-accent)" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
