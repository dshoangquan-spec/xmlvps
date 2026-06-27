'use client';

import { exportToExcel, exportToExcelViettel } from '@/lib/excel-exporter';
import type { useToast } from '@/hooks/use-toast';
import type { InvoiceItem as ParsedInvoiceItem } from '@/types/invoice';
import type { Supplier } from '@/types/firebase';

type Toast = ReturnType<typeof useToast>['toast'];

export function useInvoiceExport(toast: Toast, supplierMapping: Map<string, Supplier>) {
  const handleExport = (data: ParsedInvoiceItem[], type: 'goc' | 'anhxa') => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu để xuất.",
      });
      return;
    }
    exportToExcel(data, type, supplierMapping);
  };

  const handleExportViettel = (data: ParsedInvoiceItem[]) => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu để xuất.",
      });
      return;
    }
    exportToExcelViettel(data, supplierMapping);
  };

  return {
    handleExport,
    handleExportViettel,
  };
}
