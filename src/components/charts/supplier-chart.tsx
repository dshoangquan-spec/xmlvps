
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface TopSuppliersTableProps {
  data: { name: string; value: number }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

export default function TopSuppliersTable({ data }: TopSuppliersTableProps) {
  const [topCount, setTopCount] = useState<string>('10');
  const topData = data.slice(0, parseInt(topCount));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Top {topCount} Nhà cung cấp</CardTitle>
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
        <ScrollArea className="h-[300px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-[10%]">Hạng</TableHead>
                <TableHead className="w-[60%]">Tên nhà cung cấp</TableHead>
                <TableHead className="w-[30%] text-right">Tổng giá trị</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topData.length > 0 ? (
                topData.map((supplier, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(supplier.value)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
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
