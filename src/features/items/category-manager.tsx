import { Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCategories, useCreateCategory, useUpdateCategory } from "@/hooks/queries";
import type { Category } from "@/types/domain";

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManager({ open, onOpenChange }: CategoryManagerProps) {
  const { workspace } = useWorkspaceContext();
  const { data: categories = [] } = useCategories(workspace.id);
  const createCategory = useCreateCategory(workspace.id);
  const updateCategory = useUpdateCategory(workspace.id);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setError(null);
  };

  const addCategory = async () => {
    if (!newName.trim()) {
      setError("Give the category a name.");
      return;
    }
    try {
      await createCategory.mutateAsync({ name: newName });
      toast.success(`“${newName.trim()}” added.`);
      setNewName("");
      setError(null);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : "The category could not be added.";
      setError(message);
      toast.error(message);
    }
  };

  const saveEdit = async (category: Category) => {
    try {
      await updateCategory.mutateAsync({
        id: category.id,
        patch: { name: editingName },
      });
      toast.success("Category renamed.");
      setEditingId(null);
      setError(null);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : "The category could not be saved.";
      setError(message);
      toast.error(message);
    }
  };

  const toggleActive = async (category: Category, isActive: boolean) => {
    try {
      await updateCategory.mutateAsync({ id: category.id, patch: { isActive } });
      toast.success(
        isActive
          ? `${category.name} is available again.`
          : `${category.name} hidden from quick entry.`,
      );
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "The category could not be updated.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Categories keep your reports readable. Deactivating one hides it from quick entry but
            keeps past expenses intact.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void addCategory();
          }}
        >
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Bakery"
            aria-label="New category name"
            maxLength={40}
          />
          <Button type="submit" className="shrink-0 px-4" disabled={createCategory.isPending}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </form>
        {error ? (
          <p role="alert" className="mt-2 text-[11.5px] text-terracotta">
            {error}
          </p>
        ) : null}

        <ul className="mt-4 max-h-[45dvh] space-y-1 overflow-y-auto pr-1">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex min-h-12 items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-parchment/50"
            >
              {editingId === category.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    aria-label={`Rename ${category.name}`}
                    className="h-9 flex-1 text-sm"
                    maxLength={40}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveEdit(category);
                      }
                      if (event.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button
                    size="icon-sm"
                    variant="primary"
                    onClick={() => void saveEdit(category)}
                    aria-label="Save category name"
                    disabled={updateCategory.isPending}
                  >
                    <Check className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel rename"
                  >
                    <X className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="min-w-0 flex-1 truncate text-[13px] text-espresso"
                    aria-current={!category.is_active ? "false" : undefined}
                  >
                    {category.name}
                    {!category.is_active ? (
                      <span className="ml-2 text-[10px] text-mocha">Inactive</span>
                    ) : null}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => startEdit(category)}
                    aria-label={`Rename ${category.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Switch
                    checked={category.is_active}
                    onCheckedChange={(checked) => void toggleActive(category, checked)}
                    aria-label={`${category.is_active ? "Deactivate" : "Activate"} ${category.name}`}
                    disabled={updateCategory.isPending}
                  />
                </>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[10.5px] leading-relaxed text-mocha">
          Renaming a category updates reports without changing any saved expense amounts.
        </p>
      </DialogContent>
    </Dialog>
  );
}
