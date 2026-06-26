
"use client";

import * as XLSX from "xlsx";
import type { MasterCatalogItem as FirebaseMasterCatalogItem } from "@/types/firebase";

// This is the type that will be used within this file.
// It matches the Firebase type but we redefine it here for clarity.
export type MasterCatalogItem = FirebaseMasterCatalogItem;

export type ColumnMap = {
  [K in keyof MasterCatalogItem]: string | null;
};

// Heuristic to guess initial column mapping
export const guessMasterCatalogColumnMapping = (headers: string[]): ColumnMap => {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim().replace(/\s+/g, ' '));
  const mapping: ColumnMap = {
    id: null,
    productName: null,
    activeIngredient: null,
    concentration: null,
    registrationNumber: null,
    packaging: null,
    unit: null,
    smallestUnit: null,
    conversionRate: null,
  };

  const findHeader = (keywords: string[]): string | null => {
    for (const keyword of keywords) {
      const index = lowerHeaders.findIndex(h => h.includes(keyword));
      if (index !== -1) return headers[index];
    }
    return null;
  };

  mapping.id = findHeader(['mã sp', 'mã sản phẩm', 'product code']);
  mapping.productName = findHeader(['tên sp', 'tên sản phẩm', 'product name']);
  mapping.activeIngredient = findHeader(['hoạt chất', 'active ingredient']);
  mapping.concentration = findHeader(['hàm lượng', 'concentration']);
  mapping.registrationNumber = findHeader(['sdk', 'số đăng ký', 'registration number']);
  mapping.packaging = findHeader(['quy cách', 'qc', 'packaging']);
  mapping.unit = findHeader(['đvt', 'đơn vị tính', 'unit']);
  mapping.smallestUnit = findHeader(['đvt nhỏ nhất', 'đơn vị nhỏ nhất', 'smallest unit']);
  mapping.conversionRate = findHeader(['hệ số qđ', 'hệ số quy đổi', 'hs quy đổi', 'conversion rate']);

  return mapping;
};

export async function processMasterCatalogFile(
  file: File,
  columnMap: ColumnMap
): Promise<Map<string, MasterCatalogItem>> {
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
        
        const idx: { [K in keyof MasterCatalogItem]-?: number } = {
          id: getIndex('id'),
          productName: getIndex('productName'),
          activeIngredient: getIndex('activeIngredient'),
          concentration: getIndex('concentration'),
          registrationNumber: getIndex('registrationNumber'),
          packaging: getIndex('packaging'),
          unit: getIndex('unit'),
          smallestUnit: getIndex('smallestUnit'),
          conversionRate: getIndex('conversionRate'),
        };

        if (idx.id === -1 || idx.productName === -1 || idx.unit === -1) {
          throw new Error("Thiếu cột bắt buộc. Vui lòng chọn cột cho 'Mã SP', 'Tên sản phẩm' và 'ĐVT'.");
        }

        const mapping = new Map<string, MasterCatalogItem>();
        for (const row of dataRows) {
          const id = String(row[idx.id] || "").trim();
          const productName = String(row[idx.productName] || "").trim();
          const unit = String(row[idx.unit] || "").trim();

          if (!id || !productName || !unit) continue;

          const rateString = idx.conversionRate > -1 ? String(row[idx.conversionRate] || '1').replace(',', '.') : '1';
          const conversionRate = parseFloat(rateString);

          const item: MasterCatalogItem = {
            id,
            productName,
            unit,
            activeIngredient: idx.activeIngredient > -1 ? String(row[idx.activeIngredient] || "").trim() : '',
            concentration: idx.concentration > -1 ? String(row[idx.concentration] || "").trim() : '',
            registrationNumber: idx.registrationNumber > -1 ? String(row[idx.registrationNumber] || "").trim() : '',
            packaging: idx.packaging > -1 ? String(row[idx.packaging] || "").trim() : '',
            smallestUnit: idx.smallestUnit > -1 ? String(row[idx.smallestUnit] || "").trim() : '',
            conversionRate: !isNaN(conversionRate) ? conversionRate : 1,
          };

          mapping.set(id, item);
        }
        resolve(mapping);
      } catch (err: any) {
        reject(new Error(err.message || "Lỗi khi phân tích tệp danh mục chung."));
      }
    };

    reader.onerror = () => reject(new Error("Không thể đọc tệp."));
    reader.readAsArrayBuffer(file);
  });
}
