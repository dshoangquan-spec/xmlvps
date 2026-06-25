
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
import { Undo2, Check, X, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface AlreadyMappedTableProps {
  items: ProcessingItem[];
  onUpdate: (updatedItem: { id: string; newValues: Partial<Mapping> }) => void;
  onUnmap: (itemToUnmap: ProcessingItem) => void;
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

export function AlreadyMappedTable({ items, onUpdate, onUnmap, masterCatalog }: AlreadyMappedTableProps) {
  const [unitOptions, setUnitOptions] = useState(initialUnitOptions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<ProcessingItem | null>(null);
  const { toast } = useToast();

  const handleEdit = (item: ProcessingItem) => {
    setEditingId(item.id);
    setEditFormData(JSON.parse(JSON.stringify(item))); // Deep copy
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };
  
  const handleSaveEdit = () => {
    if (editFormData) {
        onUpdate({ id: editFormData.id, newValues: editFormData });
        toast({ title: "Đã cập nhật ánh xạ." });
        handleCancelEdit();
    }
  }

  const handleInputChange = (
    field: keyof Mapping,
    value: string | number
  ) => {
    if (editFormData) {
        if (field === 'conversionRate') {
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            setEditFormData({ ...editFormData, [field]: isNaN(numValue) ? 1 : numValue });
        } else {
            setEditFormData({ ...editFormData, [field]: value });
        }
    }
  };

  const handleAddUnit = (newUnit: string) => {
    if (newUnit && !unitOptions.some(opt => opt.value.toLowerCase() === newUnit.toLowerCase())) {
      const newOption = { value: newUnit, label: newUnit };
      setUnitOptions(prev => [newOption, ...prev].sort((a,b) => a.label.localeCompare(b.label)));
    }
  };

  if (items.length === 0) {
    return null; // Don't render anything if there are no items
  }
  
  return (
    <div>
        <ScrollArea className="h-[400px] w-full rounded-md border">
        <Table className="table-fixed w-full">
            <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
                <TableHead className="font-semibold w-[15%]">Mã hàng gốc</TableHead>
                <TableHead className="font-semibold w-[25%]">Tên hàng hóa (gốc)</TableHead>
                <TableHead className="font-semibold w-[25%]">Tên hàng hóa (mới)</TableHead>
                <TableHead className="font-semibold w-[12%]">Mã ánh xạ mới</TableHead>
                <TableHead className="font-semibold w-[10%]">ĐVT mới</TableHead>
                <TableHead className="font-semibold w-[8%]">Quy đổi</TableHead>
                <TableHead className="font-semibold w-[5%] text-center">Hành động</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {items.map((item) => {
                const isEditing = editingId === item.id;
                const currentData = isEditing && editFormData ? editFormData : item;

                return (
                <TableRow 
                    key={item.id}
                    className={cn(isEditing && "bg-secondary")}
                >
                <TableCell className="font-medium align-top break-words" title={currentData?.originalCode}>{currentData?.originalCode}</TableCell>
                <TableCell className="text-muted-foreground align-top break-words" title={currentData?.originalName}>
                    {currentData?.originalName} <Badge variant="outline">{currentData?.originalUnit}</Badge>
                </TableCell>
                <TableCell>
                    {isEditing ? (
                         <Input
                            value={currentData?.newName || ''}
                            onChange={(e) => handleInputChange('newName', e.target.value)}
                            placeholder="Tên hàng mới..."
                            className="h-8"
                        />
                    ) : (
                        currentData?.newName
                    )}
                </TableCell>
                <TableCell>
                    {isEditing ? (
                        <Input
                            value={currentData?.newCode || ''}
                            onChange={(e) => handleInputChange('newCode', e.target.value)}
                            placeholder="Mã mới..."
                            className="h-8"
                        />
                     ) : (
                        currentData?.newCode
                    )}
                </TableCell>
                <TableCell>
                    {isEditing ? (
                        <Combobox
                            options={unitOptions}
                            value={currentData?.newUnit || ''}
                            onChange={(value) => handleInputChange('newUnit', value)}
                            onAddOption={handleAddUnit}
                            placeholder="Chọn ĐVT..."
                            searchPlaceholder="Tìm hoặc thêm..."
                            emptyPlaceholder="Không có kết quả."
                        />
                    ) : (
                        currentData?.newUnit
                    )}
                </TableCell>
                <TableCell>
                    {isEditing ? (
                        <Input
                            type="number"
                            value={currentData?.conversionRate || 1}
                            onChange={(e) => handleInputChange('conversionRate', e.target.value)}
                            className="h-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={0}
                        />
                    ) : (
                        <div className="text-right">{currentData?.conversionRate}</div>
                    )}
                </TableCell>
                <TableCell className="text-center align-top">
                     {isEditing ? (
                        <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={handleSaveEdit}><Check className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelEdit}><X className="h-4 w-4"/></Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEdit(item)} title="Chỉnh sửa"><Pencil className="h-4 w-4" /></Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-orange-600"
                                onClick={() => onUnmap(item)}
                                title="Hủy ánh xạ và xử lý thủ công"
                            >
                                <Undo2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </TableCell>
                </TableRow>
            )})}
            </TableBody>
        </Table>
        </ScrollArea>
    </div>
  );
}
