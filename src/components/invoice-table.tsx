
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
import { Badge } from './ui/badge';
import { Button } from './ui/button';

import { Download } from 'lucide-react';

interface InvoiceTableProps {
  data: InvoiceItem[];
  searchTerm?: string;
  itemsPerPage?: number;
  showFileName?: boolean;
  onDownloadXml?: (fileName: string) => void;
}

const formatNumber = (num: number | string) => {
  if (typeof num === 'number') {
    return num.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return num;
};

export function InvoiceTable({ data, searchTerm = '', itemsPerPage = 50, showFileName = false, onDownloadXml }: InvoiceTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowercasedFilter = searchTerm.toLowerCase();
    return data.filter(item => 
      Object.values(item).some(value => 
        String(value).toLowerCase().includes(lowercasedFilter)
      )
    );
  }, [data, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const hasMappedData = data.some(item => item['Mã hàng (gốc)']);
  
  const baseHeaders: (keyof InvoiceItem)[] = [
    'Mã hàng', 'Tên hàng hóa', 'Nhà sản xuất', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Số lô', 'Hạn dùng'
  ];

  let headers: (keyof InvoiceItem)[] = [...baseHeaders];
  if (hasMappedData) {
    headers.unshift('Mã hàng (gốc)');
  }
  if (showFileName) {
    headers.push('Tên file');
  }
  
  if (paginatedData.length === 0) {
    return <div className="text-center text-muted-foreground p-8">Không có dữ liệu để hiển thị.</div>
  }

  const getHeaderClass = (header: keyof InvoiceItem) => {
    switch (header) {
      case 'Mã hàng (gốc)': return 'w-[12%]';
      case 'Mã hàng': return 'w-[12%]';
      case 'Tên hàng hóa': return showFileName ? 'w-[18%]' : 'w-[22%]';
      case 'Nhà sản xuất': return 'w-[14%]';
      case 'ĐVT': return 'w-[8%]';
      case 'Số lượng': return 'w-[8%] text-right';
      case 'Đơn giá': return 'w-[10%] text-right';
      case 'Thành tiền': return 'w-[12%] text-right';
      case 'Số lô': return 'w-[13%]';
      case 'Hạn dùng': return 'w-[12%]';
      case 'Tên file': return 'w-[15%]';
      default: return 'w-auto';
    }
  };
  
  const getCellClass = (header: string) => {
     switch (header) {
      case 'Số lượng':
      case 'Đơn giá':
      case 'Thành tiền': return 'text-right';
      default: return '';
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <>
      <ScrollArea className="h-[500px] w-full rounded-md border shadow-md">
        <Table className="table-fixed">
          <TableHeader className="sticky top-0 bg-secondary z-10">
            <TableRow>
              {headers.map(header => (
                <TableHead key={header as string} className={`whitespace-nowrap font-semibold ${getHeaderClass(header as keyof InvoiceItem)}`}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((item, index) => (
              <TableRow key={`${item['Số hóa đơn']}-${item['Mã hàng']}-${index}`}>
                {headers.map(header => (
                  <TableCell key={header as string} className={`break-words ${getCellClass(header as string)}`}>
                    {header === 'Tên file' ? (
                      <div className="flex items-center gap-2 justify-between">
                        <span className="truncate max-w-[120px]" title={item['Tên file']}>{item['Tên file']}</span>
                        {onDownloadXml && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-primary hover:text-primary/80"
                            onClick={() => onDownloadXml(item['Tên file'])}
                            title="Tải tệp XML gốc"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ) : header === 'Tên hàng hóa' && !item[header] ? (
                      <div className="flex items-center gap-2">
                         <Badge variant="outline">Chưa có</Badge>
                      </div>
                    ) : ['Số lượng', 'Đơn giá', 'Thành tiền'].includes(header as string) ? (
                      formatNumber(item[header as 'Số lượng' | 'Đơn giá' | 'Thành tiền'])
                    ) : (
                      item[header as keyof InvoiceItem]
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      <div className="flex items-center justify-end space-x-2 py-4">
        <span className="text-sm text-muted-foreground">
          Trang {currentPage} trên {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Trước
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Sau
        </Button>
      </div>
    </>
  );
}
