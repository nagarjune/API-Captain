import { useState, useRef, useCallback } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";

interface SyntaxHighlightedEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: "json" | "markup" | "text" | "javascript";
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  errorLine?: number | null;
  minHeight?: string;
}

export function SyntaxHighlightedEditor({
  value,
  onChange,
  language,
  placeholder,
  className,
  hasError,
  errorLine,
  minHeight = "200px",
}: SyntaxHighlightedEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isDarkTheme = useIsDarkTheme();
  
  // Map javascript to jsx for prism (better highlighting)
  const prismLanguage = language === "javascript" ? "jsx" : language;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + "  " + value.substring(end);
        onChange(newValue);

        // Set cursor position after the inserted spaces
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [value, onChange]
  );

  const syncScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const highlightPre = textarea.parentElement?.querySelector("pre");
    if (highlightPre) {
      highlightPre.scrollTop = textarea.scrollTop;
      highlightPre.scrollLeft = textarea.scrollLeft;
    }
  }, []);

  return (
    <div
      className={cn(
        "relative rounded-md border bg-background font-mono text-sm",
        isFocused && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        hasError && "border-destructive",
        hasError && isFocused && "ring-destructive",
        className
      )}
    >
      <ScrollArea style={{ height: minHeight }}>
        <div className="relative" style={{ minHeight }}>
          {/* Syntax highlighted layer */}
          <Highlight theme={isDarkTheme ? themes.nightOwl : themes.nightOwlLight} code={value || " "} language={prismLanguage}>
            {({ className: preClassName, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={cn(
                  preClassName,
                  "absolute inset-0 p-3 m-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
                )}
                style={{ ...style, background: "transparent" }}
              >
                {tokens.map((line, i) => {
                  const lineProps = getLineProps({ line });
                  const isErrorLine = errorLine !== null && errorLine === i + 1;
                  return (
                    <div
                      key={i}
                      {...lineProps}
                      className={cn(
                        lineProps.className,
                        isErrorLine && "bg-destructive/20 -mx-3 px-3 border-l-2 border-destructive"
                      )}
                    >
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  );
                })}
              </pre>
            )}
          </Highlight>

          {/* Editable textarea layer */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            spellCheck={false}
            className={cn(
              "relative w-full p-3 m-0 resize-none",
              "bg-transparent text-transparent caret-foreground",
              "outline-none border-none",
              "whitespace-pre-wrap break-words",
              "placeholder:text-muted-foreground"
            )}
            style={{ caretColor: "hsl(var(--foreground))", minHeight }}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
