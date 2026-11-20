import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint, Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useWorkspaceContext } from "@/app/workspace-context";
import { useCategories, useCreateItem, useUpdateItem } from "@/hooks/queries";
import { UNITS } from "@/lib/constants";
import { currencySymbol, formatRate, toPaise } from "@/lib/money";
import { itemFormSchema, type ItemFormValues } from "@/lib/validations";
import type { Item } from "@/types/domain";

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  initialName?: string;
  defaultCategoryId?: string;
  onSaved?: (item: Item) => void;
}

export function ItemDialog({
  open,
  onOpenChange,
  item,
  initialName,
  defaultCategoryId,
  onSaved,
}: ItemDialogProps) {
  const { workspace, actorId, currency } = useWorkspaceContext();
  const { data: categories = [] } = useCategories(workspace.id);
  const createItem = useCreateItem(workspace.id);
  const updateItem = useUpdateItem(workspace.id, actorId);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      rateRupees: 0,
      unit: "cup",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: item?.name ?? initialName ?? "",
      categoryId: item?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "",
      rateRupees: item ? item.default_rate / 100 : 0,
      unit: item?.unit ?? "cup",
      isActive: item?.is_active ?? true,
    });
  }, [open, item, initialName, defaultCategoryId, categories, form]);

  const isEditing = Boolean(item);
  const isPending = createItem.isPending || updateItem.isPending;

  const onSubmit = async (values: ItemFormValues) => {
    try {
      const input = {
        name: values.name,
        categoryId: values.categoryId,
        defaultRate: toPaise(values.rateRupees),
        unit: values.unit,
        isActive: values.isActive,
      };
      const saved = item
        ? await updateItem.mutateAsync({ id: item.id, input })
        : await createItem.mutateAsync(input);
      toast.success(isEditing ? `${saved.name} updated.` : `${saved.name} added to your catalogue.`);
      onSaved?.(saved);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The item could not be saved.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit item" : "New item"}</DialogTitle>
          <DialogDescription>
            Set the default rate. Historical expenses keep the price they were saved with.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="item-name">Item name</Label>
            <Input
              id="item-name"
              placeholder="e.g. Masala Chai"
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-category">Category</Label>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="item-category" aria-label="Item category">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{form.formState.errors.categoryId?.message}</FieldError>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-rate">Default rate</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-mocha">
                  {currencySymbol(currency)}
                </span>
                <Input
                  id="item-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="pl-8"
                  aria-invalid={Boolean(form.formState.errors.rateRupees)}
                  {...form.register("rateRupees", { valueAsNumber: true })}
                />
              </div>
              <FieldError>{form.formState.errors.rateRupees?.message}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-unit">Unit</Label>
              <Controller
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="item-unit" aria-label="Item unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-3">
            <div>
              <Label htmlFor="item-active">Available for quick entry</Label>
              <FieldHint>Inactive items stay in your history.</FieldHint>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="item-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Available for quick entry"
                />
              )}
            />
          </div>

          {item && item.default_rate !== toPaise(form.watch("rateRupees") || 0) ? (
            <p className="rounded-xl bg-parchment/70 px-3 py-2 text-[11.5px] leading-relaxed text-mocha">
              Rate will change from {formatRate(item.default_rate, currency)} to{" "}
              {formatRate(toPaise(form.watch("rateRupees") || 0), currency)}. Past expenses are not
              affected.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending} disabled={isPending}>
              {isEditing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
