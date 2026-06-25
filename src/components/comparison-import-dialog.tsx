
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb } from 'lucide-react';
import type { ComparisonColumnMap } from '@/lib/comparison-parser';
import { guessComparisonColumnMapping } from '@/lib/comparison-parser';
import { Label } from './ui/label';
import { Input } from './ui/input';

export interface ExcelData {
  headers: string[];
  preview: (string | number | null)[][];
}

interface ComparisonImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  excelData: ExcelData;
  onConfirm: (columnMap: ComparisonColumnMap, startRow: number) => void;
}

const fields: Array<{ key: keyof ComparisonColumnMap; label: string; required?: boolean }> = [
  { key: 'invoiceNumber', label: 'Số hóa đơn', required: true },
  { key: 'taxCode', label: 'Mã số thuế NCC', required: true },
  { key: 'totalAmount', label: 'Tổng tiền hàng' },
  { key: 'totalTax', label: 'Tổng tiền thuế' },
  { key: 'totalDiscount', label: 'Tổng chiết khấu' },
  { key: 'status', label: 'Trạng thái hóa đơn' },
];

export function ComparisonImportDialog({ isOpen, onOpenChange, excelData, onConfirm }: ComparisonImportDialogProps) {
  const [columnMap, setColumnMap] = useState<ComparisonColumnMap>(() => guessComparisonColumnMapping(excelData?.headers || []));
  const [startRow, setStartRow] = useState(7);
  
  useEffect(() => {
    if (isOpen && excelData?.headers) {
      setColumnMap(guessComparisonColumnMapping(excelData.headers));
    }
  }, [excelData, isOpen]);

  const handleSelectChange = (field: keyof ComparisonColumnMap, value: string) => {
    setColumnMap(prev => ({ ...prev, [field]: value === 'none' ? null : value }));
  };

  const handleSubmit = () => {
    if (!columnMap.invoiceNumber || !columnMap.taxCode) {
      alert("Vui lòng chọn cột cho 'Số hóa đơn' và 'Mã số thuế NCC'.");
      return;
    }
    onConfirm(columnMap, startRow);
  };
  
  const headers = excelData?.headers || [];
  const preview = excelData?.preview || [];

  const allHeadersWithNone = useMemo(() => ['-- Bỏ qua --', ...headers], [headers]);
  const selectValue = (key: keyof ComparisonColumnMap) => columnMap[key] || 'none';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Thiết lập cột đối chiếu</DialogTitle>
          <DialogDescription>
            Chọn các cột tương ứng từ file Excel để chương trình thực hiện đối chiếu.
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Mẹo!</AlertTitle>
          <AlertDescription>
            Chương trình đã tự động đoán các cột dựa trên tiêu đề. Hãy kiểm tra và điều chỉnh nếu cần.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
                <Label htmlFor="startRow">Dòng bắt đầu dữ liệu</Label>
                <Input 
                    id="startRow"
                    type="number"
                    value={startRow}
                    onChange={(e) => setStartRow(parseInt(e.target.value, 10))}
                    min={1}
                />
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 my-4">
          {fields.map(({ key, label, required }) => (
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
                        {fields.map(f => (
                            <TableHead key={f.key}>{f.label}</TableHead>
                        ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {preview.map((row, rowIndex) => (
                        <TableRow key={`row-${rowIndex}`}>
                            {fields.map(({ key }) => {
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={!columnMap.invoiceNumber || !columnMap.taxCode}>
            Xác nhận và Đối chiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
