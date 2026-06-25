
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Loader2 } from 'lucide-react';
import type { ColumnMap } from '@/lib/mapping-parser';

export interface ExcelData {
  headers: string[];
  preview: any[][];
}

interface MappingImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  excelData: ExcelData;
  onConfirm: (columnMap: ColumnMap) => void;
  isImporting: boolean;
}

const requiredFields: Array<{ key: keyof ColumnMap; label: string; required?: boolean }> = [
  { key: 'supplierTaxCode', label: 'Mã số thuế NCC'},
  { key: 'xmlCode', label: 'Mã hàng XML', required: true },
  { key: 'newCode', label: 'Mã ánh xạ mới', required: true },
  { key: 'newName', label: 'Tên hàng hóa mới' },
  { key: 'originalUnit', label: 'ĐVT (gốc)' },
  { key: 'newUnit', label: 'ĐVT mới' },
  { key: 'conversionRate', label: 'Tỷ lệ quy đổi' },
];

// Heuristic to guess initial column mapping
const guessInitialMapping = (headers: string[]): ColumnMap => {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim().replace(/\s+/g, ' '));
  const mapping: ColumnMap = {
    supplierTaxCode: null, xmlCode: null, newName: null, originalUnit: null,
    newCode: null, newUnit: null, conversionRate: null
  };

  const findHeader = (keywords: string[]): string | null => {
    for (const keyword of keywords) {
      const index = lowerHeaders.findIndex(h => h.includes(keyword));
      if (index !== -1) return headers[index];
    }
    return null;
  };

  mapping.supplierTaxCode = findHeader(['mã số thuế', 'mst', 'tax code']);
  mapping.xmlCode = findHeader(['mã hàng xml', 'mã xml', 'xml code', 'mã hàng (xml)', 'mã gốc', 'code', 'mã hàng gốc (xml)']);
  mapping.newCode = findHeader(['mã ánh xạ', 'mã mới', 'new code', 'mã dược quốc gia']);
  mapping.newName = findHeader(['tên hàng hóa mới', 'tên mới', 'new name', 'tên hàng hóa (mới)', 'tên thuốc', 'tên hoạt chất']);
  mapping.originalUnit = findHeader(['đvt (gốc)', 'đvt gốc', 'đơn vị tính (gốc)', 'đvt xml', 'đvt']);
  mapping.newUnit = findHeader(['đvt mới', 'đvt (mới)', 'đơn vị tính (mới)', 'đvt ánh xạ', 'đơn vị mới']);
  mapping.conversionRate = findHeader(['quy đổi', 'tỷ lệ quy đổi', 'tỷ lệ', 'conversion rate', 'conversion']);

  return mapping;
};

export function MappingImportDialog({ isOpen, onOpenChange, excelData, onConfirm, isImporting }: MappingImportDialogProps) {
  const [columnMap, setColumnMap] = useState<ColumnMap>(() => guessInitialMapping(excelData?.headers || []));
  
  // Re-guess mapping if excelData changes
  useEffect(() => {
    if (isOpen && excelData?.headers) {
      setColumnMap(guessInitialMapping(excelData.headers));
    }
  }, [excelData, isOpen]);

  const handleSelectChange = (field: keyof ColumnMap, value: string) => {
    setColumnMap(prev => ({ ...prev, [field]: value === 'none' ? null : value }));
  };

  const handleSubmit = () => {
    if (!columnMap.xmlCode || !columnMap.newCode) {
      // This should ideally be communicated via UI, e.g., toast or inline error
      alert("Vui lòng chọn cột cho 'Mã hàng XML' và 'Mã ánh xạ mới'.");
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
          <DialogTitle>Thiết lập ánh xạ cột</DialogTitle>
          <DialogDescription>
            Hãy "dạy" cho chương trình biết cột nào trong file Excel của bạn chứa thông tin gì.
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Mẹo!</AlertTitle>
          <AlertDescription>
            Cột "Mã số thuế" là không bắt buộc. Nếu bỏ trống, các quy tắc sẽ được áp dụng chung cho tất cả nhà cung cấp (giống như phiên bản cũ).
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

                            return (
                                <TableCell key={`${rowIndex}-${key}`}>
                                {cellValue}
                                </TableCell>
                            );
                            })}
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isImporting || !columnMap.xmlCode || !columnMap.newCode}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận và Nhập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
