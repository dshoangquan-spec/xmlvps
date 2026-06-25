
"use client";

import * as XLSX from "xlsx";

export interface ExcelRowData {
  totalAmount: number;
  totalTax: number;
  totalDiscount: number;
  status: string | null;
}

export interface ComparisonItem {
    invoiceNumber: string;
    supplierName: string;
    xmlTotalAmount: number | null;
    excelTotalAmount: number | null;
    xmlTotalTax: number | null;
    excelTotalTax: number | null;
    xmlTotalDiscount: number | null;
    excelTotalDiscount: number | null;
    status: string | null;
    matchStatus: ' khớp' | 'lệch' | 'chỉ có trong xml' | 'chỉ có trong excel';
}

export type ComparisonColumnMap = {
  invoiceNumber: string | null;
  taxCode: string | null;
  totalAmount: string | null;
  totalTax: string | null;
  totalDiscount: string | null;
  status: string | null;
};

export const guessComparisonColumnMapping = (headers: string[]): ComparisonColumnMap => {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim().replace(/\s+/g, ' '));
  const mapping: ComparisonColumnMap = {
    invoiceNumber: null,
    taxCode: null,
    totalAmount: null,
    totalTax: null,
    totalDiscount: null,
    status: null,
  };

  const findHeader = (keywords: string[]): string | null => {
    for (const keyword of keywords) {
      const index = lowerHeaders.findIndex(h => h.includes(keyword));
      if (index !== -1) return headers[index];
    }
    return null;
  };

  mapping.invoiceNumber = findHeader(['số hóa đơn', 'invoice no']);
  mapping.taxCode = findHeader(['mst', 'tax code', 'mã số thuế']);
  mapping.totalAmount = findHeader(['tiền hàng', 'tổng tiền chưa thuế', 'amount']);
  mapping.totalTax = findHeader(['tiền thuế', 'tổng tiền thuế', 'tax']);
  mapping.totalDiscount = findHeader(['chiết khấu', 'tổng ck', 'discount']);
  mapping.status = findHeader(['trạng thái', 'status']);

  return mapping;
};

const parseNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
}

// Cleans the tax code by removing non-numeric characters, except for a potential leading hyphen.
const cleanTaxCode = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/[^0-9-]/g, '');
}

export async function processComparisonFile(
  file: File,
  columnMap: ComparisonColumnMap,
  startRow: number
): Promise<Map<string, ExcelRowData>> {
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
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as (string | number | null)[][];

        if (json.length < startRow) {
          resolve(new Map());
          return;
        }
        
        const headers = json[startRow - 2].map(h => String(h || '')); // Header is at startRow - 1
        const dataRows = json.slice(startRow - 1);
        
        const getIndex = (key: keyof ComparisonColumnMap) => {
          const colName = columnMap[key];
          return colName ? headers.indexOf(colName) : -1;
        };
        
        const idx = {
          invoiceNumber: getIndex('invoiceNumber'),
          taxCode: getIndex('taxCode'),
          totalAmount: getIndex('totalAmount'),
          totalTax: getIndex('totalTax'),
          totalDiscount: getIndex('totalDiscount'),
          status: getIndex('status'),
        };

        if (idx.invoiceNumber === -1 || idx.taxCode === -1) {
          throw new Error("Thiếu cột bắt buộc. Vui lòng chọn cột cho 'Số hóa đơn' và 'Mã số thuế NCC'.");
        }

        const excelDataMap = new Map<string, ExcelRowData>();

        for (const row of dataRows) {
          const invoiceNumber = String(row[idx.invoiceNumber] || '').trim();
          const taxCode = cleanTaxCode(row[idx.taxCode]);

          if (!invoiceNumber || !taxCode) continue;

          const key = `${invoiceNumber}_${taxCode}`;
          
          const entry: ExcelRowData = {
              totalAmount: idx.totalAmount > -1 ? parseNumber(row[idx.totalAmount]) : 0,
              totalTax: idx.totalTax > -1 ? parseNumber(row[idx.totalTax]) : 0,
              totalDiscount: idx.totalDiscount > -1 ? parseNumber(row[idx.totalDiscount]) : 0,
              status: idx.status > -1 ? String(row[idx.status] || '') : null
          };

          excelDataMap.set(key, entry);
        }
        resolve(excelDataMap);
      } catch (err: any) {
        reject(new Error(err.message || "Lỗi khi phân tích tệp đối chiếu."));
      }
    };

    reader.onerror = () => reject(new Error("Không thể đọc tệp."));
    reader.readAsArrayBuffer(file);
  });
}
