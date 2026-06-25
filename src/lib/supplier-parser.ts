"use client";

import * as XLSX from "xlsx";
import type { Supplier } from "@/types/firebase";

export type ColumnMap = {
  id: string | null;          // Tax ID
  supplierCode: string | null;
  supplierName: string | null;
};

// Heuristic to guess initial column mapping
export const guessSupplierColumnMapping = (headers: string[]): ColumnMap => {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim().replace(/\s+/g, ' '));
  const mapping: ColumnMap = {
    id: null,
    supplierCode: null,
    supplierName: null,
  };

  const findHeader = (keywords: string[]): string | null => {
    for (const keyword of keywords) {
      const index = lowerHeaders.findIndex(h => h.includes(keyword));
      if (index !== -1) return headers[index];
    }
    return null;
  };

  mapping.id = findHeader(['mã số thuế', 'mst', 'tax id', 'tax code']);
  mapping.supplierCode = findHeader(['mã nhà cung cấp', 'mã ncc', 'supplier code']);
  mapping.supplierName = findHeader(['tên nhà cung cấp', 'tên ncc', 'supplier name']);

  return mapping;
};

const extractTaxId = (cellValue: any): string => {
  if (cellValue == null) return "";
  // Ensure value is a string and clean it
  return String(cellValue).trim().replace(/[^0-9-]/g, "");
};

export async function processSupplierFile(
  file: File,
  columnMap: ColumnMap
): Promise<Map<string, Supplier>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) {
        return reject(new Error("Không thể đọc tệp."));
      }

      try {
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Tệp Excel không có trang tính nào.");
        
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (json.length < 2) {
          resolve(new Map());
          return;
        }

        const headers = json[0].map(String);
        const dataRows = json.slice(1);
        
        const getIndex = (key: keyof ColumnMap) => {
          const colName = columnMap[key];
          return colName ? headers.indexOf(colName) : -1;
        };
        
        const idx = {
          id: getIndex('id'),
          supplierCode: getIndex('supplierCode'),
          supplierName: getIndex('supplierName'),
        };

        if (idx.id === -1 || idx.supplierName === -1) {
          throw new Error("Thiếu cột bắt buộc. Vui lòng chọn cột cho 'Mã số thuế' và 'Tên nhà cung cấp'.");
        }

        const mapping = new Map<string, Supplier>();
        for (const row of dataRows) {
          const taxId = extractTaxId(row[idx.id]);
          const supplierName = String(row[idx.supplierName] || "").trim();

          if (!taxId || !supplierName) continue;

          const supplierCode = idx.supplierCode > -1 ? String(row[idx.supplierCode] || "").trim() : '';

          mapping.set(taxId, {
            id: taxId,
            supplierCode,
            supplierName,
          });
        }
        resolve(mapping);
      } catch (err: any) {
        reject(new Error(err.message || "Lỗi khi phân tích tệp NCC."));
      }
    };

    reader.onerror = () => reject(new Error("Không thể đọc tệp."));
    reader.readAsArrayBuffer(file);
  });
}
