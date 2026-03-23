import { useState } from "react";
import { Check, Plus, Trash2, Wand2 } from "lucide-react";
import { Button, Input, Card } from "@/components/ui";
import { useShoppingStore, useMealPlanStore, useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";
import { getWeekStart } from "@/lib/utils";

export default function Shopping() {
  const { familyGroup } = useFamilyStore();
  const { items, addItem, toggleItem, deleteItem, clearChecked, generateFromPlan } = useShoppingStore();
  const { getPlan } = useMealPlanStore();
  const { recipes } = useRecipeStore();
  
  const [newItem, setNewItem] = useState("");
  const weekStart = getWeekStart();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    addItem({ name: newItem.trim(), category: "other", family_code: familyGroup!.code });
    setNewItem("");
  };

  const handleAutoGenerate = () => {
    const plan = getPlan(weekStart, familyGroup!.code);
    generateFromPlan(plan, recipes);
  };

  // Group items by category
  const activeItems = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-6 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Shopping List</p>
            <h1 className="text-3xl font-display font-bold">Groceries</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleAutoGenerate} className="gap-2 h-9 text-xs">
            <Wand2 size={14} /> Sync Plan
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input 
            placeholder="Add item..." 
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" className="shrink-0"><Plus size={20} /></Button>
        </form>

        <div className="space-y-3">
          {activeItems.length === 0 && checkedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCartIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Your list is empty.</p>
            </div>
          ) : null}

          {activeItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white p-4 rounded-xl border border-border shadow-sm">
              <button 
                onClick={() => toggleItem(item.id)}
                className="w-6 h-6 rounded-full border-2 border-primary/40 flex items-center justify-center hover:border-primary transition-colors"
              />
              <span className="flex-1 font-medium">{item.name}</span>
              <button onClick={() => deleteItem(item.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {checkedItems.length > 0 && (
            <div className="pt-6 mt-6 border-t border-border/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-muted-foreground">Checked Items</h3>
                <button onClick={() => clearChecked(familyGroup!.code)} className="text-xs font-semibold text-destructive">
                  Clear All
                </button>
              </div>
              <div className="space-y-2 opacity-60">
                {checkedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-secondary/50 p-3 rounded-lg">
                    <button 
                      onClick={() => toggleItem(item.id)}
                      className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center"
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <span className="flex-1 line-through decoration-primary/30 text-sm">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShoppingCartIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>;
}
