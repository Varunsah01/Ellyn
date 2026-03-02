"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";

const AlertDialog = Dialog;
const AlertDialogTrigger = DialogTrigger;
const AlertDialogContent = DialogContent;
const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;

const AlertDialogAction = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ ...props }, ref) => <Button ref={ref} {...props} />
);
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "outline", ...props }, ref) => (
    <Button ref={ref} variant={variant} {...props} />
  )
);
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
