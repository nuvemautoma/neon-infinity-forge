import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", hover = false, onClick }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={hover ? { y: -4, scale: 1.02 } : undefined}
      onClick={onClick}
      className={`glass rounded-2xl p-6 ${hover ? "cursor-pointer hover-lift" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
