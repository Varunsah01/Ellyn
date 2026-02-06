"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnimatedButtonProps extends ButtonProps {
  children: React.ReactNode;
}

export const AnimatedButton = React.forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(({ className, children, ...props }, ref) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Button
        ref={ref}
        className={cn("transition-all duration-200", className)}
        {...props}
      >
        {children}
      </Button>
    </motion.div>
  );
});

AnimatedButton.displayName = "AnimatedButton";

export function PulseButton({ children, ...props }: AnimatedButtonProps) {
  return (
    <motion.div
      animate={{
        boxShadow: [
          "0 0 0 0 rgba(59, 130, 246, 0.7)",
          "0 0 0 10px rgba(59, 130, 246, 0)",
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        repeatType: "loop",
      }}
      className="rounded-md"
    >
      <AnimatedButton {...props}>{children}</AnimatedButton>
    </motion.div>
  );
}

export function ShakeButton({ children, ...props }: AnimatedButtonProps) {
  return (
    <motion.div
      whileHover={{
        x: [0, -5, 5, -5, 5, 0],
        transition: { duration: 0.5 },
      }}
    >
      <Button {...props}>{children}</Button>
    </motion.div>
  );
}
