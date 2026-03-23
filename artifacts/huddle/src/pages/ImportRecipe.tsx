import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Link as LinkIcon, FileText, Download } from "lucide-react";
import { Button, Input, Card } from "@/components/ui";
import { useAiMutation } from "@/hooks/use-ai";
import { useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";

export default function ImportRecipe() {
  const [, setLocation] = useLocation();
  const { familyGroup } = useFamilyStore();
  const { addRecipe } = useRecipeStore();
  const aiMutation = useAiMutation();
  
  const [tab, setTab] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const handleImport = async () => {
    const source = tab === "url" ? url : text;
    if (!source) return;

    const prompt = `Extract this recipe from ${tab}: ${source}. Return JSON with name, emoji, photo_color(hex), cuisine, cook_time, calories, protein, vegetarian, ingredients[{name, amount, category}], method[string].`;

    try {
      const res = await aiMutation.mutateAsync({ prompt, responseFormat: "json" });
      const parsed = JSON.parse(res.result);
      
      const newRecipe = addRecipe({
        ...parsed,
        family_code: familyGroup!.code,
        imported: true,
        source_url: tab === "url" ? url : undefined
      });
      
      setLocation(`/recipe/${newRecipe.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="p-6 bg-white border-b border-border flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-secondary">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-display font-bold">Import Recipe</h1>
      </header>

      <div className="p-6 flex-1 flex flex-col gap-6">
        <div className="flex bg-secondary p-1 rounded-xl">
          <button 
            onClick={() => setTab("url")} 
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${tab === "url" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            <LinkIcon size={16} /> URL
          </button>
          <button 
            onClick={() => setTab("text")} 
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${tab === "text" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            <FileText size={16} /> Paste Text
          </button>
        </div>

        {tab === "url" ? (
          <Input 
            placeholder="https://cooking-site.com/recipe" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
        ) : (
          <textarea 
            className="w-full h-48 bg-white border-2 border-border rounded-xl p-4 text-sm focus:outline-none focus:border-primary resize-none"
            placeholder="Paste ingredients and instructions here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        )}

        <div className="mt-auto pb-4">
          <Card className="bg-primary/5 border-primary/20 mb-6 border-dashed">
            <h4 className="font-semibold text-primary mb-1 text-sm">AI Extraction</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our AI will automatically read the source and format it cleanly into ingredients, method steps, and extract nutrition info.
            </p>
          </Card>

          <Button 
            className="w-full" 
            size="lg"
            onClick={handleImport}
            isLoading={aiMutation.isPending}
            disabled={tab === "url" ? !url : !text}
          >
            <Download className="mr-2 w-5 h-5" /> Import & Parse
          </Button>
        </div>
      </div>
    </div>
  );
}
