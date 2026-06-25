
"use client";

import React, { useState } from 'react';
import type { Mapping, MasterCatalogItem, ProcessingItem } from '@/types/firebase';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Combobox } from './ui/combobox';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { X } from 'lucide-react';


interface ManualMappingTableProps {
  items: ProcessingItem[];
  onUpdate: (updatedItem: { id: string; newValues: Partial<Mapping> }) => void;
  onIgnore: (id: string) => void;
  selectedId: string | null;
  onSelectRow: (id: string) => void;
  masterCatalog: Map<string, MasterCatalogItem>;
}

const initialUnitOptions = [
  { value: "Viên", label: "Viên" },
  { value: "Chai", label: "Chai" },
  { value: "Lọ", label: "Lọ" },
  { value: "Ống", label: "Ống" },
  { value: "Túi", label: "Túi" },
  { value: "Tuýp", label: "Tuýp" },
  { value: "Hộp", label: "Hộp" },
  { value: "Gói", label: "Gói" },
  { value: "Vỉ", label: "Vỉ" },
  { value: "Cái", label: "Cái" },
];

export function ManualMappingTable({ items, onUpdate, onIgnore, selectedId, onSelectRow, masterCatalog }: ManualMappingTableProps) {
  const [unitOptions, setUnitOptions] = useState(initialUnitOptions);
  
  const handleInputChange = (
    id: string,
    field: keyof Mapping,
    value: string | number
  ) => {
    if (field === 'conversionRate') {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      onUpdate({ id, newValues: { [field]: isNaN(numValue) ? 1 : numValue } });
    } else {
      onUpdate({ id, newValues: { [field]: value } });
    }
  };

  const handleAddUnit = (newUnit: string) => {
    if (newUnit && !unitOptions.some(opt => opt.value.toLowerCase() === newUnit.toLowerCase())) {
      const newOption = { value: newUnit, label: newUnit };
      setUnitOptions(prev => [newOption, ...prev].sort((a,b) => a.label.localeCompare(b.label)));
    }
  };

  if (items.length === 0) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8 border rounded-md">
            <h3 className="font-semibold text-foreground">Tuyệt vời!</h3>
            <p>Tất cả các mã hàng đã được ánh xạ.</p>
        </div>
    );
  }
  
  return (
    <div>
        <ScrollArea className="h-[400px] w-full rounded-md border">
        <Table className="table-fixed w-full">
            <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
                <TableHead className="font-semibold w-[15%]">Mã hàng gốc</TableHead>
                <TableHead className="font-semibold w-[30%]">Tên hàng hóa (gốc)</TableHead>
                <TableHead className="font-semibold w-[20%]">Tên hàng hóa (mới)</TableHead>
                <TableHead className="font-semibold w-[12%]">Mã ánh xạ mới</TableHead>
                <TableHead className="font-semibold w-[10%]">ĐVT mới</TableHead>
                <TableHead className="font-semibold w-[8%]">Quy đổi</TableHead>
                <TableHead className="font-semibold w-[5%] text-center">Hành động</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {items.map((item) => (
                <TableRow 
                    key={item.id}
                    onClick={() => onSelectRow(item.id!)}
                    className={cn(
                        "cursor-pointer",
                        selectedId === item.id && "bg-primary/10 hover:bg-primary/20"
                    )}
                >
                <TableCell className="font-medium align-top break-words" title={item.originalCode}>{item.originalCode}</TableCell>
                <TableCell className="text-muted-foreground align-top break-words" title={item.originalName}>
                    {item.originalName} <Badge variant="outline">{item.originalUnit}</Badge>
                </TableCell>
                <TableCell>
                    <Input
                    value={item.newName || ''}
                    onChange={(e) => handleInputChange(item.id!, 'newName', e.target.value)}
                    placeholder="Tên hàng mới..."
                    className="h-8"
                    />
                </TableCell>
                <TableCell>
                    <Input
                    value={item.newCode || ''}
                    onChange={(e) => handleInputChange(item.id!, 'newCode', e.target.value)}
                    placeholder="Mã mới..."
                    className="h-8"
                    />
                </TableCell>
                <TableCell>
                    <Combobox
                    options={unitOptions}
                    value={item.newUnit || ''}
                    onChange={(value) => handleInputChange(item.id!, 'newUnit', value)}
                    onAddOption={handleAddUnit}
                    placeholder="Chọn ĐVT..."
                    searchPlaceholder="Tìm hoặc thêm..."
                    emptyPlaceholder="Không có kết quả."
                    />
                </TableCell>
                <TableCell>
                    <Input
                    type="number"
                    value={item.conversionRate || 1}
                    onChange={(e) =>
                        handleInputChange(item.id!, 'conversionRate', e.target.value)
                    }
                    className="h-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min={0}
                    />
                </TableCell>
                <TableCell className="text-center align-top">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            onIgnore(item.id!);
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
        </ScrollArea>
    </div>
  );
}
