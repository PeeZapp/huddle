import { useState } from "react";
import { Link } from "wouter";
import { Search, Plus, Filter, Download } from "lucide-react";
import { Input, Badge, Button } from "@/components/ui";
import { useRecipeStore } from "@/stores/huddle-stores";

export default function Recipes() {
  const { recipes } = useRecipeStore();
  const [search, setSearch] = useState("");

  const filtered = recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-display font-bold">Library</h1>
          <Link href="/import">
            <Button variant="ghost" size="icon" className="bg-secondary rounded-full w-10 h-10">
              <Download size={18} className="text-primary" />
            </Button>
          </Link>
        </div>
        <div className="flex gap-2">
          <Input 
            placeholder="Search recipes..." 
            icon={<Search size={18} />} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12"
          />
          <Button variant="outline" className="w-12 h-12 p-0 shrink-0 border-2">
            <Filter size={18} />
          </Button>
        </div>
      </header>

      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <img src={`${import.meta.env.BASE_URL}images/empty-plate.png`} alt="Empty" className="w-16 h-16 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No recipes yet</h3>
            <p className="text-muted-foreground mb-8">Import your favorites or create a new one to get started.</p>
            <div className="flex flex-col gap-3">
              <Link href="/import">
                <Button className="w-full">Import Recipe via AI</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map(recipe => (
              <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
                <div className="bg-white border border-border rounded-2xl p-4 flex flex-col h-full active:scale-95 transition-transform cursor-pointer shadow-sm hover:shadow-md">
                  <div 
                    className="w-full aspect-square rounded-xl mb-3 flex items-center justify-center text-4xl"
                    style={{ backgroundColor: recipe.photo_color || '#f3f4f6' }}
                  >
                    {recipe.emoji || "🍲"}
                  </div>
                  <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2 flex-1">{recipe.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {recipe.cook_time && <span className="text-[10px] text-muted-foreground">{recipe.cook_time}m</span>}
                    {recipe.calories && <span className="text-[10px] text-muted-foreground">{recipe.calories}c</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
