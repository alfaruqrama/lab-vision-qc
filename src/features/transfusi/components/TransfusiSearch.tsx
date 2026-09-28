import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BLOOD_PRODUCTS, type BloodProduct, type TransfusiFilters } from '@/lib/transfusi-types';

interface Props {
  filters: TransfusiFilters;
  onChange: (filters: TransfusiFilters) => void;
}

export default function TransfusiSearch({ filters, onChange }: Props) {
  const hasFilters = filters.search || filters.dateFrom || filters.dateTo || filters.bloodProduct;

  const clearFilters = () => {
    onChange({});
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari nomor kantong, nama pasien, atau no RM..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          className="pl-9 text-xs"
        />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Bersihkan pencarian"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
          className="text-xs h-8 w-auto"
          aria-label="Tanggal dari"
        />
        <span className="text-xs text-muted-foreground">s/d</span>
        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
          className="text-xs h-8 w-auto"
          aria-label="Tanggal sampai"
        />

        <Select
          value={filters.bloodProduct ?? 'ALL'}
          onValueChange={(v) =>
            onChange({ ...filters, bloodProduct: v === 'ALL' ? undefined : (v as BloodProduct) })
          }
        >
          <SelectTrigger className="h-8 text-xs w-[170px]">
            <SelectValue placeholder="Produk darah" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua produk</SelectItem>
            {BLOOD_PRODUCTS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label.split(' (')[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
