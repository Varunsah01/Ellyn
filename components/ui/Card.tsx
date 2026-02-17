import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Render the Card component.
 * @param {React.HTMLAttributes<HTMLDivElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <Card />
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

/**
 * Render the CardHeader component.
 * @param {React.HTMLAttributes<HTMLDivElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CardHeader />
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

/**
 * Render the CardTitle component.
 * @param {React.HTMLAttributes<HTMLHeadingElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CardTitle />
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

/**
 * Render the CardDescription component.
 * @param {React.HTMLAttributes<HTMLParagraphElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CardDescription />
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

/**
 * Render the CardContent component.
 * @param {React.HTMLAttributes<HTMLDivElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CardContent />
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

/**
 * Render the CardFooter component.
 * @param {React.HTMLAttributes<HTMLDivElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <CardFooter />
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
