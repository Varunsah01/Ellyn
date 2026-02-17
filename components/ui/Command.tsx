"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "@/lib/utils"

/**
 * Render the Command component.
 * @param {React.ComponentPropsWithoutRef<typeof CommandPrimitive>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <Command />
 */
const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

/**
 * Command Dialog.
 * @param {React.ComponentProps<typeof CommandPrimitive.Dialog>} props - Function input.
 * @returns {unknown} Computed unknown.
 * @example
 * CommandDialog()
 */
const CommandDialog = ({ children, ...props }: React.ComponentProps<typeof CommandPrimitive.Dialog>) => {
  return (
    <CommandPrimitive.Dialog {...props}>
      <div className="fixed inset-0 z-50 bg-black/80">
        <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
            {children}
          </Command>
        </div>
      </div>
    </CommandPrimitive.Dialog>
  )
}

/**
 * Render the CommandInput component.
 * @param {React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CommandInput />
 */
const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

/**
 * Render the CommandList component.
 * @param {React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CommandList />
 */
const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))

CommandList.displayName = CommandPrimitive.List.displayName

/**
 * Render the CommandEmpty component.
 * @param {React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CommandEmpty />
 */
const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm"
    {...props}
  />
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

/**
 * Render the CommandGroup component.
 * @param {React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CommandGroup />
 */
const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

/**
 * Render the CommandSeparator component.
 * @param {React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CommandSeparator />
 */
const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

/**
 * Render the CommandItem component.
 * @param {React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CommandItem />
 */
const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
}
