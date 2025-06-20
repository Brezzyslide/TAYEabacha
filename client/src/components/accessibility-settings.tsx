import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Sun, Moon, Contrast, Type } from "lucide-react";

export function AccessibilitySettings() {
  const { theme, fontSize, setTheme, setFontSize } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="hover:bg-accent rounded-lg p-2"
          title="Accessibility Settings"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 card-elevated">
        <DropdownMenuLabel className="text-sm font-medium">
          Accessibility Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className={theme === "light" ? "bg-accent" : ""}
        >
          <Sun className="h-4 w-4 mr-2" />
          Light Mode
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className={theme === "dark" ? "bg-accent" : ""}
        >
          <Moon className="h-4 w-4 mr-2" />
          Dark Mode
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("high-contrast")}
          className={theme === "high-contrast" ? "bg-accent" : ""}
        >
          <Contrast className="h-4 w-4 mr-2" />
          High Contrast
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Font Size
        </DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={() => setFontSize("small")}
          className={fontSize === "small" ? "bg-accent" : ""}
        >
          <Type className="h-3 w-3 mr-2" />
          Small
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setFontSize("normal")}
          className={fontSize === "normal" ? "bg-accent" : ""}
        >
          <Type className="h-4 w-4 mr-2" />
          Normal
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setFontSize("large")}
          className={fontSize === "large" ? "bg-accent" : ""}
        >
          <Type className="h-5 w-5 mr-2" />
          Large
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setFontSize("xl")}
          className={fontSize === "xl" ? "bg-accent" : ""}
        >
          <Type className="h-6 w-6 mr-2" />
          Extra Large
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}