import React from 'react';

const CATEGORIES = [
  'All',
  'Automotive Fundamentals',
  'Electrical Systems',
  'Electronics',
  'Engine Systems',
  'Diagnostics',
  'Vehicle Maintenance'
];

interface CategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange
}) => {
  return (
    <div className="flex flex-wrap gap-2 mb-12">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
            activeCategory === category
              ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-blue hover:text-brand-blue'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};
