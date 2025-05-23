
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Save,
  Settings,
  Search,
  FileText,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

declare global {
  interface Window {
    CodeMirror: any;
  }
}

interface File {
  id: string;
  name: string;
  content: string;
  language: string;
}

interface EditorSettings {
  fontSize: number;
  tabSize: number;
  theme: "light" | "dark" | "device";
  convertTabsToSpaces: boolean;
  lineWrapping: boolean;
  lineNumbers: boolean;
}

const CodeEditor = () => {
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<EditorSettings>({
    fontSize: 16,
    tabSize: 2,
    theme: "dark",
    convertTabsToSpaces: true,
    lineWrapping: true,
    lineNumbers: true,
  });
  
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<any>(null);

  // Initialize editor when component mounts
  useEffect(() => {
    if (typeof window === 'undefined' || !window.CodeMirror || !editorRef.current) return;

    // Create new file if no files exist
    if (files.length === 0) {
      createNewFile();
    }

    // Load settings from localStorage
    const savedSettings = localStorage.getItem("codemate-settings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      } catch (error) {
        console.error("Failed to parse settings:", error);
      }
    }

    // Check system preference for theme
    if (settings.theme === "device" && window.matchMedia) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
    } else if (settings.theme === "dark" || settings.theme === "light") {
      applyTheme(settings.theme);
    }
    
    // Watch for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (settings.theme === "device") {
        applyTheme(e.matches ? "dark" : "light");
      }
    };
    
    mediaQuery.addEventListener("change", handleThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange);
    };
  }, []);

  // Initialize or update editor when active file changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.CodeMirror || !editorRef.current) return;
    
    const activeFile = files.find(file => file.id === activeFileId);
    if (!activeFile) return;

    if (!editorInstanceRef.current) {
      // Initialize editor
      editorInstanceRef.current = window.CodeMirror(editorRef.current, {
        value: activeFile.content,
        mode: getModeByLanguage(activeFile.language),
        theme: settings.theme === "dark" ? "material" : "eclipse",
        lineNumbers: settings.lineNumbers,
        lineWrapping: settings.lineWrapping,
        tabSize: settings.tabSize,
        indentWithTabs: !settings.convertTabsToSpaces,
        scrollbarStyle: "overlay",
      });

      editorInstanceRef.current.on("change", (cm: any) => {
        if (!activeFileId) return;
        
        // Update file content when editor changes
        const content = cm.getValue();
        setFiles(prevFiles => 
          prevFiles.map(file => 
            file.id === activeFileId ? { ...file, content } : file
          )
        );
      });
    } else {
      // Update editor content and mode
      const currentContent = editorInstanceRef.current.getValue();
      if (currentContent !== activeFile.content) {
        editorInstanceRef.current.setValue(activeFile.content);
      }
      editorInstanceRef.current.setOption("mode", getModeByLanguage(activeFile.language));
    }
    
    // Apply settings
    editorInstanceRef.current.setOption("theme", settings.theme === "dark" ? "material" : "eclipse");
    editorInstanceRef.current.setOption("lineNumbers", settings.lineNumbers);
    editorInstanceRef.current.setOption("lineWrapping", settings.lineWrapping);
    editorInstanceRef.current.setOption("tabSize", settings.tabSize);
    editorInstanceRef.current.setOption("indentWithTabs", !settings.convertTabsToSpaces);
    
    // Apply font size
    editorRef.current.style.fontSize = `${settings.fontSize}px`;
  }, [activeFileId, files, settings]);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem("codemate-settings", JSON.stringify(settings));
  }, [settings]);

  // Create a new file
  const createNewFile = () => {
    const newFile: File = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: "untitled.txt",
      content: "",
      language: "text/plain",
    };
    
    setFiles(prevFiles => [...prevFiles, newFile]);
    setActiveFileId(newFile.id);
    
    toast.success(`Created new file: ${newFile.name}`);
  };

  // Open a file
  const openFile = async () => {
    try {
      // Use only the traditional file input method for better compatibility
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".txt,.js,.html,.css,.py,.php,.sql";
      
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        const selectedFile = target.files?.[0];
        
        if (selectedFile) {
          const content = await selectedFile.text();
          const name = selectedFile.name;
          const language = getLanguageByFileName(name);
          
          // Check if file is already open
          const existingFileIndex = files.findIndex(f => f.name === name);
          if (existingFileIndex >= 0) {
            // Update existing file
            const updatedFile = { ...files[existingFileIndex], content, language };
            setFiles(prevFiles => 
              prevFiles.map(f => f.id === updatedFile.id ? updatedFile : f)
            );
            setActiveFileId(updatedFile.id);
          } else {
            // Add new file
            const newFile: File = {
              id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name,
              content,
              language,
            };
            setFiles(prevFiles => [...prevFiles, newFile]);
            setActiveFileId(newFile.id);
          }
          
          toast.success(`Opened file: ${name}`);
        }
      };
      
      input.click();
    } catch (err) {
      console.error("Error opening file:", err);
      toast.error("Failed to open file");
    }
  };

  // Save the current file
  const saveFile = async () => {
    const activeFile = files.find(file => file.id === activeFileId);
    if (!activeFile) return;
    
    try {
      // Use only the traditional download method for better compatibility
      const blob = new Blob([activeFile.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = activeFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded file: ${activeFile.name}`);
    } catch (err) {
      console.error("Error saving file:", err);
      toast.error("Failed to save file");
    }
  };

  // Close a file
  const closeFile = (fileId: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
    
    // If we closed the active file, activate another file
    if (fileId === activeFileId) {
      const remainingFiles = files.filter(file => file.id !== fileId);
      if (remainingFiles.length > 0) {
        setActiveFileId(remainingFiles[0].id);
      } else {
        setActiveFileId(null);
        // If no files left, create a new one
        createNewFile();
      }
    }
  };

  // Search in the current file
  const handleSearch = () => {
    if (!editorInstanceRef.current || !searchQuery) return;
    
    const cursor = editorInstanceRef.current.getSearchCursor(searchQuery);
    
    if (cursor.findNext()) {
      editorInstanceRef.current.setSelection(cursor.from(), cursor.to());
      editorInstanceRef.current.scrollIntoView(cursor.from(), 50);
    } else {
      // Try from the beginning
      cursor.jumpTo(0);
      if (cursor.findNext()) {
        editorInstanceRef.current.setSelection(cursor.from(), cursor.to());
        editorInstanceRef.current.scrollIntoView(cursor.from(), 50);
      } else {
        toast.info(`No matches found for "${searchQuery}"`);
      }
    }
  };

  // Apply theme to the application - Fixed to only accept 'light' or 'dark'
  const applyTheme = (theme: "light" | "dark") => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // Update editor theme if initialized
    if (editorInstanceRef.current) {
      editorInstanceRef.current.setOption("theme", theme === "dark" ? "material" : "eclipse");
    }
  };

  // Determine the correct mode by language or file extension
  const getModeByLanguage = (language: string): string => {
    switch (language) {
      case "javascript":
        return "javascript";
      case "html":
        return "htmlmixed";
      case "css":
        return "css";
      case "python":
        return "python";
      case "php":
        return "php";
      case "sql":
        return "sql";
      default:
        return "null";
    }
  };

  // Get language by file name
  const getLanguageByFileName = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    
    switch (extension) {
      case "js":
        return "javascript";
      case "html":
      case "htm":
        return "html";
      case "css":
        return "css";
      case "py":
        return "python";
      case "php":
        return "php";
      case "sql":
        return "sql";
      default:
        return "text/plain";
    }
  };

  // Get MIME type by extension
  const getMimeTypeByExtension = (extension: string): string => {
    switch (extension.toLowerCase()) {
      case "js":
        return "application/javascript";
      case "html":
      case "htm":
        return "text/html";
      case "css":
        return "text/css";
      case "py":
        return "text/plain";
      case "php":
        return "application/x-httpd-php";
      case "sql":
        return "application/sql";
      default:
        return "text/plain";
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+N: New file
      if (event.ctrlKey && event.key === "n") {
        event.preventDefault();
        createNewFile();
      }
      
      // Ctrl+O: Open file
      if (event.ctrlKey && event.key === "o") {
        event.preventDefault();
        openFile();
      }
      
      // Ctrl+S: Save file
      if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        saveFile();
      }
      
      // Ctrl+Tab: Next file
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        if (files.length <= 1) return;
        
        const currentIndex = files.findIndex(file => file.id === activeFileId);
        const nextIndex = (currentIndex + 1) % files.length;
        setActiveFileId(files[nextIndex].id);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files, activeFileId]);

  // Handle search on Enter key
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="codemate-container">
      {/* Sidebar or Settings Panel */}
      <div className="sidebar">
        {settingsOpen ? (
          /* Settings Panel */
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Settings</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSettingsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <Separator className="my-4" />
            
            <div className="settings-group">
              <h3 className="settings-title">Editor</h3>
              
              <div className="form-group">
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="fontSize" className="form-label">Font Size: {settings.fontSize}px</Label>
                </div>
                <Slider
                  id="fontSize"
                  min={8}
                  max={48}
                  step={1}
                  value={[settings.fontSize]}
                  onValueChange={(value) => setSettings({...settings, fontSize: value[0]})}
                  className="w-full"
                />
              </div>
              
              <div className="form-group">
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="tabSize" className="form-label">Tab Size: {settings.tabSize}</Label>
                </div>
                <Slider
                  id="tabSize"
                  min={1}
                  max={8}
                  step={1}
                  value={[settings.tabSize]}
                  onValueChange={(value) => setSettings({...settings, tabSize: value[0]})}
                  className="w-full"
                />
              </div>
              
              <div className="form-group flex items-center space-x-2">
                <Checkbox
                  id="convertTabsToSpaces"
                  checked={settings.convertTabsToSpaces}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, convertTabsToSpaces: checked === true})
                  }
                />
                <Label htmlFor="convertTabsToSpaces">Convert tabs to spaces</Label>
              </div>
              
              <div className="form-group flex items-center space-x-2">
                <Checkbox
                  id="lineWrapping"
                  checked={settings.lineWrapping}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, lineWrapping: checked === true})
                  }
                />
                <Label htmlFor="lineWrapping">Line wrapping</Label>
              </div>
              
              <div className="form-group flex items-center space-x-2">
                <Checkbox
                  id="lineNumbers"
                  checked={settings.lineNumbers}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, lineNumbers: checked === true})
                  }
                />
                <Label htmlFor="lineNumbers">Show line numbers</Label>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="settings-group">
              <h3 className="settings-title">Appearance</h3>
              
              <div className="form-group">
                <Label htmlFor="theme" className="form-label">Theme</Label>
                <Select 
                  value={settings.theme} 
                  onValueChange={(value: "light" | "dark" | "device") => {
                    setSettings({...settings, theme: value});
                    
                    if (value === "device") {
                      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                      applyTheme(prefersDark ? "dark" : "light");
                    } else if (value === "light" || value === "dark") {
                      applyTheme(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="device">System Preference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => setSettingsOpen(false)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Editor
              </Button>
            </div>
          </>
        ) : (
          /* Regular Sidebar */
          <>
            <div className="sidebar-section">
              <h1 className="text-2xl font-bold mb-4">CodeMate</h1>
            </div>
            
            <div className="sidebar-section">
              <div className="sidebar-title">File</div>
              <div className="flex flex-col space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={createNewFile}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New File
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={openFile}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Open File
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={saveFile}
                  disabled={!activeFileId}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save As
                </Button>
              </div>
            </div>
            
            <div className="sidebar-section flex-1">
              <div className="sidebar-title">Open Files</div>
              {files.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">No files open</div>
              ) : (
                <div className="flex flex-col space-y-1">
                  {files.map(file => (
                    <div 
                      key={file.id} 
                      className={`flex items-center p-2 rounded-md cursor-pointer ${file.id === activeFileId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                      onClick={() => setActiveFileId(file.id)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span className="flex-1 truncate text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeFile(file.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="sidebar-section mt-auto">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </div>
          </>
        )}
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Tabs */}
        <div className="tabs-container">
          {files.map(file => (
            <div 
              key={file.id}
              className={`tab ${file.id === activeFileId ? 'active' : ''}`}
              onClick={() => setActiveFileId(file.id)}
            >
              <span className="truncate max-w-xs inline-block align-middle">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 ml-2 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        
        {/* Search Bar */}
        <div className="search-container">
          <Input
            className="search-input"
            placeholder="Search in file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <Button variant="outline" onClick={handleSearch} disabled={!searchQuery}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Editor */}
        <div className="editor-container">
          <div ref={editorRef} className="h-full w-full" />
        </div>
      </div>
      
      {/* Remove the separate settings panel since it's now integrated into the sidebar */}
    </div>
  );
};

export default CodeEditor;
