import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { VEHICLE_BRANDS, VehicleBrand } from '@/constants/eventCategories';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface VehicleSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedBrand: VehicleBrand | null;
  onBrandChange: (brand: VehicleBrand | null) => void;
  priceRange: [number | null, number | null];
  onPriceRangeChange: (range: [number | null, number | null]) => void;
  yearRange: [number | null, number | null];
  onYearRangeChange: (range: [number | null, number | null]) => void;
  mileageMax: number | null;
  onMileageMaxChange: (max: number | null) => void;
}

export const VehicleSearch: React.FC<VehicleSearchProps> = ({
  searchQuery,
  onSearchChange,
  selectedBrand,
  onBrandChange,
  priceRange,
  onPriceRangeChange,
  yearRange,
  onYearRangeChange,
  mileageMax,
  onMileageMaxChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState(priceRange[0]?.toString() || '');
  const [maxPrice, setMaxPrice] = useState(priceRange[1]?.toString() || '');
  const [minYear, setMinYear] = useState(yearRange[0]?.toString() || '');
  const [maxYear, setMaxYear] = useState(yearRange[1]?.toString() || '');
  const [maxMileage, setMaxMileage] = useState(mileageMax?.toString() || '');

  const currentYear = new Date().getFullYear();
  const hasActiveFilters = selectedBrand || priceRange[0] || priceRange[1] || yearRange[0] || yearRange[1] || mileageMax;

  const applyFilters = () => {
    onPriceRangeChange([
      minPrice ? parseInt(minPrice) : null,
      maxPrice ? parseInt(maxPrice) : null,
    ]);
    onYearRangeChange([
      minYear ? parseInt(minYear) : null,
      maxYear ? parseInt(maxYear) : null,
    ]);
    onMileageMaxChange(maxMileage ? parseInt(maxMileage) : null);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxYear('');
    setMaxMileage('');
    onBrandChange(null);
    onPriceRangeChange([null, null]);
    onYearRangeChange([null, null]);
    onMileageMaxChange(null);
    setShowFilters(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by make, model, or keyword..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-[14px] border border-foreground focus:outline-none bg-transparent placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "px-4 py-3 border border-foreground flex items-center gap-2 transition-colors",
            showFilters || hasActiveFilters ? "bg-foreground text-background" : "bg-background text-foreground hover:bg-muted"
          )}
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span className="hidden sm:inline text-[11px] font-medium uppercase">Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-[#FA76FF]" />
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="border border-foreground p-4 md:p-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Filters</h3>
            <button 
              onClick={() => setShowFilters(false)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Brand Filter */}
            <div>
              <label className="text-[11px] font-medium uppercase text-muted-foreground mb-2 block">Brand</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full px-3 py-2.5 text-[14px] border border-foreground focus:outline-none flex items-center justify-between text-left">
                    <span className="flex items-center gap-2">
                      {selectedBrand ? (
                        <>
                          {VEHICLE_BRANDS.find(b => b.value === selectedBrand)?.emoji}
                          {VEHICLE_BRANDS.find(b => b.value === selectedBrand)?.label}
                        </>
                      ) : (
                        'All Brands'
                      )}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0 max-h-64 overflow-y-auto bg-background" align="start">
                  <button
                    onClick={() => onBrandChange(null)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors",
                      !selectedBrand && "bg-muted font-medium"
                    )}
                  >
                    All Brands
                  </button>
                  {VEHICLE_BRANDS.map((brand) => (
                    <button
                      key={brand.value}
                      onClick={() => onBrandChange(brand.value)}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2",
                        selectedBrand === brand.value && "bg-muted font-medium"
                      )}
                    >
                      <span>{brand.emoji}</span>
                      <span>{brand.label}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-[11px] font-medium uppercase text-muted-foreground mb-2 block">Price Range (R)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-foreground focus:outline-none bg-transparent"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-foreground focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Year Range */}
            <div>
              <label className="text-[11px] font-medium uppercase text-muted-foreground mb-2 block">Year</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="From"
                  min="1990"
                  max={currentYear}
                  value={minYear}
                  onChange={(e) => setMinYear(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-foreground focus:outline-none bg-transparent"
                />
                <input
                  type="number"
                  placeholder="To"
                  min="1990"
                  max={currentYear}
                  value={maxYear}
                  onChange={(e) => setMaxYear(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-foreground focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Max Mileage */}
            <div>
              <label className="text-[11px] font-medium uppercase text-muted-foreground mb-2 block">Max Mileage (km)</label>
              <input
                type="number"
                placeholder="e.g. 100000"
                value={maxMileage}
                onChange={(e) => setMaxMileage(e.target.value)}
                className="w-full px-3 py-2.5 text-[14px] border border-foreground focus:outline-none bg-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={applyFilters}
              className="px-6 py-2.5 bg-foreground text-background text-[11px] font-medium uppercase hover:bg-[#FA76FF] hover:text-foreground transition-colors"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2.5 border border-destructive text-destructive text-[11px] font-medium uppercase hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
