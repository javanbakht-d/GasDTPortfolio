"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * کلید تعویض حالت روشن/تاریک — بدون state اضافی:
 * نمایش آیکون با CSS بر اساس کلاس dark روی <html> (بدون اختلاف hydration)
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="تعویض حالت روشن/تاریک"
      title="حالت روشن / تاریک"
    >
      <Sun className="h-5 w-5 hidden dark:block transition" />
      <Moon className="h-5 w-5 block dark:hidden transition" />
    </Button>
  );
}
