import { useState, useMemo } from "react";
import { Code, Copy, Check, Terminal } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";
import {
  generateCode,
  CODE_LANGUAGES,
  CodeLanguage,
  RequestConfig,
} from "@/lib/codeGenerators";

interface CodeGeneratorDialogProps {
  config: RequestConfig;
  disabled?: boolean;
}

const LANGUAGE_MAP: Record<CodeLanguage, string> = {
  curl: "bash",
  javascript: "javascript",
  python: "python",
  node: "javascript",
  php: "php",
};

export function CodeGeneratorDialog({ config, disabled }: CodeGeneratorDialogProps) {
  const { toast } = useToast();
  const isDarkTheme = useIsDarkTheme();
  const [open, setOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<CodeLanguage>("curl");
  const [copied, setCopied] = useState(false);

  const generatedCode = useMemo(() => {
    return generateCode(activeLanguage, config);
  }, [activeLanguage, config]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          <Code className="h-4 w-4" />
          Code
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Generate Code
          </DialogTitle>
          <DialogDescription>
            Export your request as code in various languages.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeLanguage}
          onValueChange={(v) => setActiveLanguage(v as CodeLanguage)}
          className="w-full"
        >
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-secondary/50 p-1">
            {CODE_LANGUAGES.map((lang) => (
              <TabsTrigger
                key={lang.id}
                value={lang.id}
                className="text-xs px-3 py-1.5"
              >
                {lang.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {CODE_LANGUAGES.map((lang) => (
            <TabsContent key={lang.id} value={lang.id} className="mt-4">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10 gap-2"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-primary" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
                <ScrollArea className="h-[350px] rounded-lg border border-[hsl(var(--editor-border))] bg-[hsl(var(--editor-background))] text-[hsl(var(--editor-foreground))]">
                  <Highlight
                    theme={isDarkTheme ? themes.nightOwl : themes.nightOwlLight}
                    code={generatedCode}
                    language={LANGUAGE_MAP[lang.id] || "bash"}
                  >
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                      <pre
                        className={`${className} p-4 text-sm font-mono`}
                        style={{ ...style, background: "transparent" }}
                      >
                        {tokens.map((line, i) => (
                          <div key={i} {...getLineProps({ line })}>
                            <span className="inline-block w-8 text-muted-foreground/50 select-none text-right mr-4">
                              {i + 1}
                            </span>
                            {line.map((token, key) => (
                              <span key={key} {...getTokenProps({ token })} />
                            ))}
                          </div>
                        ))}
                      </pre>
                    )}
                  </Highlight>
                </ScrollArea>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
