import { useState } from "react";
import { Plus, Check, Trash2, List } from "lucide-react";
import { Button, Input, Card } from "@/components/ui";
import { useListsStore, useFamilyStore } from "@/stores/huddle-stores";

export default function Lists() {
  const { familyGroup } = useFamilyStore();
  const { lists, addList, addItem, toggleItem, deleteList } = useListsStore();
  
  const [newListTitle, setNewListTitle] = useState("");
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

  const handleAddList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    addList(newListTitle, familyGroup!.code);
    setNewListTitle("");
  };

  const handleAddItem = (listId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = newItemTexts[listId];
    if (!text?.trim()) return;
    addItem(listId, text);
    setNewItemTexts(prev => ({ ...prev, [listId]: "" }));
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-6 bg-white sticky top-0 z-20 border-b border-border/50">
        <h1 className="text-3xl font-display font-bold mb-4">Shared Lists</h1>
        <form onSubmit={handleAddList} className="flex gap-2">
          <Input 
            placeholder="New list name (e.g. Costco, To-do)" 
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            className="flex-1 h-12"
          />
          <Button type="submit" size="icon" className="shrink-0"><Plus size={20} /></Button>
        </form>
      </header>

      <div className="p-6 space-y-6">
        {lists.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <List className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Create a list to share with your family.</p>
          </div>
        ) : (
          lists.map(list => (
            <Card key={list.id} className="p-0 overflow-hidden">
              <div className="px-4 py-3 bg-secondary/30 border-b border-border flex justify-between items-center">
                <h3 className="font-bold text-lg">{list.title}</h3>
                <button onClick={() => deleteList(list.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  {list.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 group">
                      <button 
                        onClick={() => toggleItem(list.id, item.id)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${item.checked ? 'bg-primary border-primary text-white' : 'border-border'}`}
                      >
                        {item.checked && <Check size={12} strokeWidth={3} />}
                      </button>
                      <span className={`text-sm flex-1 ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
                
                <form onSubmit={(e) => handleAddItem(list.id, e)} className="flex gap-2 mt-2">
                  <input 
                    type="text"
                    placeholder="Add item..." 
                    className="flex-1 text-sm bg-transparent border-b border-border focus:border-primary focus:outline-none px-1 py-1 transition-colors"
                    value={newItemTexts[list.id] || ""}
                    onChange={(e) => setNewItemTexts(prev => ({ ...prev, [list.id]: e.target.value }))}
                  />
                  <button type="submit" className="text-primary font-semibold text-sm px-2">Add</button>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
