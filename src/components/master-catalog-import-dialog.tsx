
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb } from 'lucide-react';
import type { ColumnMap, MasterCatalogItem } from '@/lib/master-catalog-parser';
import { guessMasterCatalogColumnMapping } from '@/lib/master-catalog-parser';

export interface ExcelData {
  headers: string[];
  preview: any[][];
}

interface MasterCatalogImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  excelData: ExcelData;
  onConfirm: (columnMap: ColumnMap) => void;
}

const fields: Array<{ key: keyof MasterCatalogItem; label: string; required?: boolean }> = [
  { key: 'id', label: 'Mã SP', required: true },
  { key: 'productName', label: 'Tên sản phẩm', required: true },
  { key: 'activeIngredient', label: 'Hoạt chất' },
  { key: 'concentration', label: 'Hàm lượng' },
  { key: 'registrationNumber', label: 'Số đăng ký' },
  { key: 'packaging', label: 'Quy cách' },
  { key: 'unit', label: 'ĐVT', required: true },
  { key: 'smallestUnit', label: 'ĐVT nhỏ nhất' },
  { key: 'conversionRate', label: 'Hệ số QĐ' },
];

export function MasterCatalogImportDialog({ isOpen, onOpenChange, excelData, onConfirm }: MasterCatalogImportDialogProps) {
  const [columnMap, setColumnMap] = useState<ColumnMap>(() => guessMasterCatalogColumnMapping(excelData?.headers || []));
  
  useEffect(() => {
    if (isOpen && excelData?.headers) {
      setColumnMap(guessMasterCatalogColumnMapping(excelData.headers));
    }
  }, [excelData, isOpen]);

  const handleSelectChange = (field: keyof ColumnMap, value: string) => {
    setColumnMap(prev => ({ ...prev, [field]: value === 'none' ? null : value }));
  };

  const handleSubmit = () => {
    if (!columnMap.id || !columnMap.productName || !columnMap.unit) {
      alert("Vui lòng chọn cột cho 'Mã SP', 'Tên sản phẩm' và 'ĐVT'.");
      return;
    }
    onConfirm(columnMap);
  };
  
  const headers = excelData?.headers || [];
  const preview = excelData?.preview || [];

  const allHeadersWithNone = useMemo(() => ['-- Bỏ qua --', ...headers], [headers]);
  const selectValue = (key: keyof ColumnMap) => columnMap[key] || 'none';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Thiết lập cột cho Danh mục chung</DialogTitle>
          <DialogDescription>
            Chọn cột tương ứng từ file Excel cho từng trường thông tin của sản phẩm.
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Mẹo!</AlertTitle>
          <AlertDescription>
            Chương trình đã tự động đoán các cột. Hãy kiểm tra và điều chỉnh nếu cần.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 my-4">
          {fields.map(({ key, label, required }) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="font-semibold text-sm">
                {label} {required && <span className="text-destructive">*</span>}
              </label>
              <Select onValueChange={(value) => handleSelectChange(key as keyof ColumnMap, value)} value={selectValue(key as keyof ColumnMap)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn một cột..." />
                </SelectTrigger>
                <SelectContent>
                  {allHeadersWithNone.map((header, idx) => (
                    <SelectItem key={header + idx} value={header === '-- Bỏ qua --' ? 'none' : header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="space-y-2 mt-4">
            <p className="font-semibold text-sm">Xem trước dữ liệu sẽ nhập (5 dòng đầu):</p>
            <ScrollArea className="h-48 w-full rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                        {fields.map(f => (
                            <TableHead key={f.key}>{f.label}</TableHead>
                        ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {preview.map((row, rowIndex) => (
                        <TableRow key={`row-${rowIndex}`}>
                            {fields.map(({ key }) => {
                                const excelHeader = columnMap[key as keyof ColumnMap];
                                const cellValue = excelHeader
                                    ? row[headers.indexOf(excelHeader)]
                                    : "";
                                return <TableCell key={`${rowIndex}-${key}`}>{String(cellValue ?? "")}</TableCell>;
                            })}
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={!columnMap.id || !columnMap.productName || !columnMap.unit}>
            Xác nhận và Nhập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
