
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Loader2 } from 'lucide-react';
import type { ColumnMap } from '@/lib/supplier-parser';
import { guessSupplierColumnMapping } from '@/lib/supplier-parser';
import type { ExcelData } from './mapping-import-dialog';

interface SupplierImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  excelData: ExcelData;
  onConfirm: (columnMap: ColumnMap) => void;
  isImporting: boolean;
}

const requiredFields: Array<{ key: keyof ColumnMap; label: string; required?: boolean }> = [
  { key: 'supplierName', label: 'Tên nhà cung cấp', required: true },
  { key: 'id', label: 'Mã số thuế', required: true },
  { key: 'supplierCode', label: 'Mã nhà cung cấp' },
];

export function SupplierImportDialog({ isOpen, onOpenChange, excelData, onConfirm, isImporting }: SupplierImportDialogProps) {
  const [columnMap, setColumnMap] = useState<ColumnMap>(() => guessSupplierColumnMapping(excelData?.headers || []));
  
  useEffect(() => {
    if (isOpen && excelData?.headers) {
      setColumnMap(guessSupplierColumnMapping(excelData.headers));
    }
  }, [excelData, isOpen]);

  const handleSelectChange = (field: keyof ColumnMap, value: string) => {
    setColumnMap(prev => ({ ...prev, [field]: value === 'none' ? null : value }));
  };

  const handleSubmit = () => {
    if (!columnMap.id || !columnMap.supplierName) {
      alert("Vui lòng chọn cột cho 'Tên nhà cung cấp' và 'Mã số thuế'.");
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
          <DialogTitle>Thiết lập cột cho Nhà cung cấp</DialogTitle>
          <DialogDescription>
            Hãy "dạy" cho chương trình biết cột nào trong file Excel của bạn chứa thông tin nhà cung cấp.
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Mẹo!</AlertTitle>
          <AlertDescription>
            Chương trình đã tự động đoán các cột dựa trên tiêu đề. Hãy kiểm tra và điều chỉnh nếu cần.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          {requiredFields.map(({ key, label, required }) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="font-semibold text-sm">
                {label} {required && <span className="text-destructive">*</span>}
              </label>
              <Select onValueChange={(value) => handleSelectChange(key, value)} value={selectValue(key)}>
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
                        {requiredFields.map(f => (
                            <TableHead key={f.key}>{f.label}</TableHead>
                        ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {preview.map((row, rowIndex) => (
                        <TableRow key={`row-${rowIndex}`}>
                            {requiredFields.map(({ key }) => {
                            const excelHeader = columnMap[key];
                            const cellValue = excelHeader
                                ? row[headers.indexOf(excelHeader)]
                                : "";
                            return <TableCell key={`${rowIndex}-${key}`}>{String(cellValue)}</TableCell>;
                            })}
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isImporting || !columnMap.id || !columnMap.supplierName}>
             {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận và Nhập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
