interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}

export default function SortableHeader({ label, field, currentSort, currentDir, onSort, className = '' }: SortableHeaderProps) {
  const isActive = currentSort === field;

  return (
    <th
      className={`cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`text-xs ${isActive ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-300 dark:text-neutral-600'}`}>
          {isActive && currentDir === 'asc' ? '▲' : isActive && currentDir === 'desc' ? '▼' : '⇅'}
        </span>
      </div>
    </th>
  );
}
