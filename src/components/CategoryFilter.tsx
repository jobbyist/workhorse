import React from 'react';
import { VEHICLE_BRANDS, VehicleBrand } from '@/constants/eventCategories';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  selected: VehicleBrand | null;
  onSelect: (brand: VehicleBrand | null) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-1.5 text-[11px] font-medium uppercase border transition-colors",
          selected === null
            ? "bg-foreground text-background border-foreground"
            : "bg-background text-foreground border-border hover:border-foreground"
        )}
      >
        All Brands
      </button>
      {VEHICLE_BRANDS.map((brand) => (
        <button
          key={brand.value}
          onClick={() => onSelect(brand.value)}
          className={cn(
            "px-3 py-1.5 text-[11px] font-medium uppercase border transition-colors flex items-center gap-1.5",
            selected === brand.value
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-foreground border-border hover:border-foreground"
          )}
        >
          <span>{brand.emoji}</span>
          <span>{brand.label}</span>
        </button>
      ))}
    </div>
  );
};
