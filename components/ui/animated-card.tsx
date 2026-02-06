"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardProps } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends CardProps {
  children: React.ReactNode;
  hoverScale?: number;
  hoverLift?: boolean;
}

export const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, children, hoverScale = 1.02, hoverLift = true, ...props }, ref) => {
    return (
      <motion.div
        whileHover={{
          scale: hoverScale,
          y: hoverLift ? -4 : 0,
          boxShadow: hoverLift
            ? "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
            : undefined,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Card
          ref={ref}
          className={cn("transition-all duration-200", className)}
          {...props}
        >
          {children}
        </Card>
      </motion.div>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";

export function FadeInCard({ children, delay = 0, ...props }: AnimatedCardProps & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <AnimatedCard {...props}>{children}</AnimatedCard>
    </motion.div>
  );
}

export function SlideInCard({
  children,
  direction = "left",
  delay = 0,
  ...props
}: AnimatedCardProps & { direction?: "left" | "right" | "up" | "down"; delay?: number }) {
  const directions = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    up: { x: 0, y: -50 },
    down: { x: 0, y: 50 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <AnimatedCard {...props}>{children}</AnimatedCard>
    </motion.div>
  );
}

export function StaggeredCards({
  children,
  staggerDelay = 0.1,
}: {
  children: React.ReactNode;
  staggerDelay?: number;
}) {
  const childrenArray = React.Children.toArray(children);

  return (
    <>
      {childrenArray.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}
