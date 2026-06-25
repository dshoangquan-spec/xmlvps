"use client";

import React from 'react';
import type { Supplier } from '@/types/firebase';
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

interface UnmappedSupplierTableProps {
  suppliers: Supplier[];
  onUpdate: (taxId: string, field: keyof Supplier, value: string) => void;
  supplierMapping: Map<string, Supplier>; 
}

function UnmappedSupplierRow({
  supplier,
  existsInFirestore,
  onUpdate
}: {
  supplier: Supplier;
  existsInFirestore: boolean;
  onUpdate: (taxId: string, field: keyof Supplier, value: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <Input
          value={supplier.supplierName || ""}
          readOnly={existsInFirestore}
          className="h-9"
          placeholder="Nhập tên NCC..."
          onChange={(e) => {
            onUpdate(supplier.id, "supplierName", e.target.value);
          }}
        />
      </TableCell>

      <TableCell>
        <Input value={supplier.id} readOnly className="h-9 bg-muted/50" />
      </TableCell>

      <TableCell>
        <Input
          value={supplier.supplierCode || ""}
          placeholder="Nhập mã NCC..."
          className="h-9"
          onChange={(e) => {
            onUpdate(supplier.id, "supplierCode", e.target.value);
          }}
        />
      </TableCell>
    </TableRow>
  );
}

export function UnmappedSupplierTable({
  suppliers,
  onUpdate,
  supplierMapping,
}: UnmappedSupplierTableProps) {

  if (suppliers.length === 0) return null;

  return (
    <ScrollArea className="h-[250px] w-full rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-muted z-10">
          <TableRow>
            <TableHead className="font-semibold w-[40%]">Tên nhà cung cấp</TableHead>
            <TableHead className="font-semibold w-[30%]">Mã số thuế</TableHead>
            <TableHead className="font-semibold w-[30%]">Mã nhà cung cấp mới</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {suppliers.map((supplier) => (
            <UnmappedSupplierRow
              key={supplier.id}
              supplier={supplier}
              existsInFirestore={supplierMapping.has(supplier.id)}
              onUpdate={onUpdate}
            />
          ))}
        </TableBody>

      </Table>
    </ScrollArea>
  );
}
