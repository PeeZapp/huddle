import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function Button({ 
  className, variant = "primary", size = "default", isLoading, children, ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "glass";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-border bg-transparent hover:bg-muted text-foreground",
    ghost: "bg-transparent hover:bg-muted text-foreground",
    destructive: "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 hover:bg-destructive/90",
    glass: "bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30 shadow-xl"
  };
  
  const sizes = {
    default: "h-12 px-6 py-3",
    sm: "h-9 px-4 py-2 text-sm",
    lg: "h-14 px-8 py-4 text-lg",
    icon: "h-12 w-12 flex justify-center items-center p-0"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, onClick, hoverable = false }: React.HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl p-5 shadow-sm border border-border/50 transition-all duration-300",
        hoverable && "hover:shadow-md hover:border-border cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Input({ className, icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) {
  return (
    <div className="relative flex items-center w-full">
      {icon && <div className="absolute left-4 text-muted-foreground">{icon}</div>}
      <input
        className={cn(
          "w-full h-14 bg-background border-2 border-border text-foreground rounded-xl px-4 transition-all duration-200",
          "placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10",
          icon && "pl-11",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default"|"outline"|"success", className?: string }) {
  const variants = {
    default: "bg-primary/10 text-primary",
    outline: "border border-border text-muted-foreground",
    success: "bg-green-100 text-green-700"
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}
