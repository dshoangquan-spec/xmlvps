
'use client';

import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import type { TopProductData } from '../dashboard';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TopProductsTableProps {
  data: TopProductData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

export default function TopProductsTable({ data }: TopProductsTableProps) {
  const [topCount, setTopCount] = useState<string>('10');
  const topData = data.slice(0, parseInt(topCount));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Top {topCount} sản phẩm nhập nhiều nhất</CardTitle>
            <CardDescription>Dựa trên tổng giá trị nhập hàng trong khoảng thời gian đã chọn.</CardDescription>
          </div>
          <div className="w-28">
            <Select value={topCount} onValueChange={setTopCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-[5%]">Hạng</TableHead>
                <TableHead className="w-[15%]">Mã sản phẩm</TableHead>
                <TableHead className="w-[30%]">Tên sản phẩm</TableHead>
                <TableHead className="w-[8%] text-center">ĐVT</TableHead>
                <TableHead className="w-[12%] text-right">Giá thấp nhất</TableHead>
                <TableHead className="w-[12%] text-right">Giá cao nhất</TableHead>
                <TableHead className="w-[18%] text-right">Tổng giá trị</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topData.length > 0 ? (
                topData.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{product.code}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{product.unit}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       {product.minPrice > 0 ? formatCurrency(product.minPrice) : <Badge variant="outline">N/A</Badge>}
                    </TableCell>
                     <TableCell className="text-right">
                       {product.maxPrice > 0 ? formatCurrency(product.maxPrice) : <Badge variant="outline">N/A</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(product.value)}</TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                        Không có dữ liệu.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
