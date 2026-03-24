import { Link, useLocation } from "wouter";
import { Calendar, ShoppingCart, BookOpen, ListTodo, PieChart, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: Calendar, label: "Plan" },
    { path: "/shopping", icon: ShoppingCart, label: "Shop" },
    { path: "/recipes", icon: BookOpen, label: "Recipes" },
    { path: "/lists", icon: ListTodo, label: "Lists" },
    { path: "/nutrition", icon: PieChart, label: "Health" },
    { path: "/family", icon: Users, label: "Family" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <Link key={item.path} href={item.path} className="flex flex-col items-center justify-center w-full h-full relative group">
              <div className={cn(
                "flex flex-col items-center justify-center transition-all duration-300",
                isActive ? "text-primary -translate-y-1" : "text-muted-foreground group-hover:text-foreground"
              )}>
                <Icon className={cn("w-6 h-6 mb-1", isActive && "fill-primary/20")} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn("text-[10px] font-medium", isActive ? "opacity-100" : "opacity-70")}>{item.label}</span>
              </div>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
