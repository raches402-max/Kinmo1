"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"

interface ResponsiveDialogProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * ResponsiveDialog - Automatically uses Dialog on desktop and Drawer on mobile
 *
 * Usage:
 * <ResponsiveDialog open={open} onOpenChange={setOpen}>
 *   <ResponsiveDialogContent>
 *     <ResponsiveDialogHeader>
 *       <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
 *       <ResponsiveDialogDescription>Description</ResponsiveDialogDescription>
 *     </ResponsiveDialogHeader>
 *     ... your content ...
 *     <ResponsiveDialogFooter>
 *       ... footer buttons ...
 *     </ResponsiveDialogFooter>
 *   </ResponsiveDialogContent>
 * </ResponsiveDialog>
 */
export function ResponsiveDialog({
  children,
  ...props
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <Drawer {...props}>{children}</Drawer>
  }

  return <Dialog {...props}>{children}</Dialog>
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveDialogContent({
  children,
  className,
}: ResponsiveDialogContentProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerContent className={className}>{children}</DrawerContent>
  }

  return <DialogContent className={className}>{children}</DialogContent>
}

interface ResponsiveDialogHeaderProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveDialogHeader({
  children,
  className,
}: ResponsiveDialogHeaderProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerHeader className={className}>{children}</DrawerHeader>
  }

  return <DialogHeader className={className}>{children}</DialogHeader>
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveDialogTitle({
  children,
  className,
}: ResponsiveDialogTitleProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>
  }

  return <DialogTitle className={className}>{children}</DialogTitle>
}

interface ResponsiveDialogDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveDialogDescription({
  children,
  className,
}: ResponsiveDialogDescriptionProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerDescription className={className}>{children}</DrawerDescription>
    )
  }

  return (
    <DialogDescription className={className}>{children}</DialogDescription>
  )
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveDialogFooter({
  children,
  className,
}: ResponsiveDialogFooterProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerFooter className={className}>{children}</DrawerFooter>
  }

  return <DialogFooter className={className}>{children}</DialogFooter>
}

interface ResponsiveDialogCloseProps {
  children: React.ReactNode
  className?: string
  asChild?: boolean
}

export function ResponsiveDialogClose({
  children,
  className,
  asChild,
}: ResponsiveDialogCloseProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerClose className={className} asChild={asChild}>
        {children}
      </DrawerClose>
    )
  }

  return (
    <DialogClose className={className} asChild={asChild}>
      {children}
    </DialogClose>
  )
}
