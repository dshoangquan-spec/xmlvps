
"use client";

import { useMemo, useState } from 'react';
import type { ComparisonItem } from '@/lib/comparison-parser';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from './ui/input';
import { Search, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface ComparisonTableProps {
  data: ComparisonItem[];
}

type SortableKeys = keyof ComparisonItem;

const formatNumber = (num: number | null) => {
  if (num === null || num === undefined) return '';
  return num.toLocaleString('vi-VN');
};

const getMatchStatusVariant = (status: ComparisonItem['matchStatus']): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case ' khớp': return 'default';
        case 'lệch': return 'destructive';
        default: return 'outline';
    }
}

export function ComparisonTable({ data }: ComparisonTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' } | null>({ key: 'invoiceNumber', direction: 'asc' });

  const sortedAndFilteredData = useMemo(() => {
    let items = [...data];

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      items = items.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(lowercasedFilter)
        )
      );
    }
    
    if (sortConfig) {
        items.sort((a,b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];

            if (valA == null) return 1;
            if (valB == null) return -1;
            
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            return sortConfig.direction === 'asc' 
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA));
        })
    }

    return items;
  }, [data, searchTerm, sortConfig]);
  
  const requestSort = (key: SortableKeys) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortableHeader = ({ sortKey, children, className }: {sortKey: SortableKeys, children: React.ReactNode, className?: string}) => {
    const active = sortConfig?.key === sortKey;
    return (
      <TableHead className={cn("font-semibold", className)}>
        <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
          {children}
          <ArrowUpDown className={cn("ml-2 h-3 w-3", active ? "text-primary" : "text-muted-foreground")} />
        </Button>
      </TableHead>
    );
  };


  return (
    <div className="space-y-4">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Table>
        <TableHeader className="sticky top-0 bg-muted z-10">
          <TableRow>
            <SortableHeader sortKey="invoiceNumber" className="w-[10%]">Số HĐ</SortableHeader>
            <SortableHeader sortKey="supplierName" className="w-[15%]">Nhà CC</SortableHeader>
            <TableHead className="w-[12%] text-right font-semibold">Tiền hàng (XML)</TableHead>
            <TableHead className="w-[12%] text-right font-semibold">Tiền hàng (Excel)</TableHead>
            <TableHead className="w-[10%] text-right font-semibold">Thuế (XML)</TableHead>
            <TableHead className="w-[10%] text-right font-semibold">Thuế (Excel)</TableHead>
            <TableHead className="w-[10%] text-right font-semibold">CK (XML)</TableHead>
            <TableHead className="w-[10%] text-right font-semibold">CK (Excel)</TableHead>
            <SortableHeader sortKey="status" className="w-[10%]">Trạng thái (Excel)</SortableHeader>
            <SortableHeader sortKey="matchStatus" className="w-[10%]">Đối chiếu</SortableHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAndFilteredData.length > 0 ? sortedAndFilteredData.map((item, index) => (
            <TableRow key={index} className={item.matchStatus === 'lệch' ? 'bg-destructive/10' : ''}>
              <TableCell>{item.invoiceNumber}</TableCell>
              <TableCell>{item.supplierName}</TableCell>
              <TableCell className="text-right">{formatNumber(item.xmlTotalAmount)}</TableCell>
              <TableCell className={cn("text-right", item.xmlTotalAmount !== null && Math.abs(item.xmlTotalAmount - (item.excelTotalAmount ?? 0)) > 1 && "font-bold text-destructive")}>
                  {formatNumber(item.excelTotalAmount)}
              </TableCell>
              <TableCell className="text-right">{formatNumber(item.xmlTotalTax)}</TableCell>
              <TableCell className={cn("text-right", item.xmlTotalTax !== null && Math.abs(item.xmlTotalTax - (item.excelTotalTax ?? 0)) > 1 && "font-bold text-destructive")}>
                  {formatNumber(item.excelTotalTax)}
              </TableCell>
               <TableCell className="text-right">{formatNumber(item.xmlTotalDiscount)}</TableCell>
              <TableCell className={cn("text-right", item.xmlTotalDiscount !== null && Math.abs(item.xmlTotalDiscount - (item.excelTotalDiscount ?? 0)) > 1 && "font-bold text-destructive")}>
                  {formatNumber(item.excelTotalDiscount)}
              </TableCell>
              <TableCell>{item.status}</TableCell>
              <TableCell><Badge variant={getMatchStatusVariant(item.matchStatus)}>{item.matchStatus}</Badge></TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center">Không có dữ liệu để hiển thị.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
