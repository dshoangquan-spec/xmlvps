
"use client";

import { useMemo, useState } from 'react';
import type { InvoiceItem } from '@/types/invoice';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Download, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { exportSummaryToExcel } from '@/lib/excel-exporter';
import { useToast } from '@/hooks/use-toast';

interface InvoiceSummaryProps {
  data: InvoiceItem[];
}

export interface InvoiceSummaryData {
    invoiceNumber: string;
    issueDate: string;
    supplierName: string;
    totalAmountBeforeDiscount: number; // Tiền hàng trước CK
    totalTax: number;
    totalDiscount: number;
    grandTotal: number; // Tổng cộng tính toán (sau thuế và sau CK)
    xmlGrandTotal: number;
}

const formatNumber = (num: number | string) => {
  if (typeof num === 'number') {
    return num.toLocaleString('vi-VN');
  }
  return num;
};

export function InvoiceSummary({ data }: InvoiceSummaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const summaryData = useMemo<InvoiceSummaryData[]>(() => {
    const invoiceMap = new Map<string, InvoiceSummaryData>();

    data.forEach(item => {
      const invoiceNumber = item['Số hóa đơn'];
      let summary = invoiceMap.get(invoiceNumber);

      if (!summary) {
        summary = {
          invoiceNumber,
          issueDate: item['Ngày hóa đơn'],
          supplierName: item['Nhà cung cấp'],
          totalAmountBeforeDiscount: 0,
          totalTax: 0,
          totalDiscount: item['Tổng tiền chiết khấu'] || 0,
          grandTotal: 0,
          xmlGrandTotal: item['Tổng tiền thanh toán'] || 0,
        };
      }
      
      const quantity = item['Số lượng'] || 0;
      const unitPrice = item['Đơn giá'] || 0;
      const amountBeforeDiscount = quantity * unitPrice;
      const taxRate = parseFloat(item['Thuế suất']) / 100 || 0;
      
      // Accumulate the pre-discount amount
      summary.totalAmountBeforeDiscount += amountBeforeDiscount;

      // Tax is calculated on the amount AFTER discount
      const amountAfterItemDiscount = (item['Thành tiền'] || 0);
      const taxAmountForItem = amountAfterItemDiscount * taxRate;
      summary.totalTax += taxAmountForItem;
      
      invoiceMap.set(invoiceNumber, summary);
    });

    // Post-process to calculate final totals
    invoiceMap.forEach(summary => {
        // Grand total = (Total Before Discount - Total Invoice Discount) + Total Tax
        summary.grandTotal = summary.totalAmountBeforeDiscount - summary.totalDiscount + summary.totalTax;
    });

    return Array.from(invoiceMap.values());
  }, [data]);
  
  const filteredData = useMemo(() => {
    if (!searchTerm) return summaryData;
    const lowercasedFilter = searchTerm.toLowerCase();
    return summaryData.filter(item =>
        item.invoiceNumber.toLowerCase().includes(lowercasedFilter) ||
        item.supplierName.toLowerCase().includes(lowercasedFilter)
    );
  }, [summaryData, searchTerm]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu thống kê để xuất.",
      });
      return;
    }
    exportSummaryToExcel(filteredData);
  }

  return (
    <Card className="shadow-lg border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-4 border-b border-border/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      Thống kê hóa đơn
                      <span className="flex h-5 px-2 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                        {filteredData.length}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Tổng hợp danh sách các hóa đơn đã được tải lên và đối chiếu trong phiên làm việc.
                    </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Tìm số HĐ, tên NCC..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent className="pt-6">
            <ScrollArea className="h-[500px] w-full rounded-xl border border-border/40 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 border-b border-border/40">
                    <TableRow>
                        <TableHead className="w-[12%]">Số hóa đơn</TableHead>
                        <TableHead className="w-[10%]">Ngày lập</TableHead>
                        <TableHead className="w-[20%]">Nhà cung cấp</TableHead>
                        <TableHead className="w-[12%] text-right">Tiền hàng (trước CK)</TableHead>
                        <TableHead className="w-[10%] text-right">Giảm giá</TableHead>
                        <TableHead className="w-[10%] text-right">Tiền thuế</TableHead>
                        <TableHead className="w-[13%] text-right font-semibold">Tổng cộng (Tính)</TableHead>
                        <TableHead className="w-[13%] text-right font-semibold">Tổng cộng (XML)</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredData.length > 0 ? (
                        filteredData.map((item) => (
                        <TableRow key={item.invoiceNumber} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-semibold text-foreground">{item.invoiceNumber}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{item.issueDate}</TableCell>
                            <TableCell className="text-sm font-medium">{item.supplierName}</TableCell>
                            <TableCell className="text-right text-sm">{formatNumber(item.totalAmountBeforeDiscount)}</TableCell>
                            <TableCell className="text-right text-rose-600 dark:text-rose-400 font-semibold text-sm">{formatNumber(item.totalDiscount)}</TableCell>
                            <TableCell className="text-right text-sm">{formatNumber(item.totalTax)}</TableCell>
                            <TableCell className="text-right font-bold text-sm text-foreground">{formatNumber(item.grandTotal)}</TableCell>
                            <TableCell className="text-right font-bold text-sm text-blue-600 dark:text-blue-400">{formatNumber(item.xmlGrandTotal)}</TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground text-sm">
                            Không tìm thấy kết quả thống kê.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
        <CardFooter className="border-t border-border/40 pt-4 justify-end">
            <Button onClick={handleExport} className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-sm rounded-lg">
                <Download className="mr-2 h-4 w-4" />
                Xuất thống kê
            </Button>
      </CardFooter>
    </Card>
  );
}
