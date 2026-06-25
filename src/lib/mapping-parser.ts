
"use client";

import * as XLSX from 'xlsx';
import type { Mapping } from '@/types/firebase';

// Helper to create a combined ID for specific mappings
const createCombinedId = (taxCode: string, itemCode: string) => `${taxCode}-${itemCode.replace(/\//g, '-')}`;
const sanitizeDocId = (id: string) => id.replace(/\//g, '-');


export type ColumnMap = {
  supplierTaxCode: string | null; // Mã số thuế
  xmlCode: string | null;         // Mã hàng XML
  newCode: string | null;         // Mã ánh xạ mới
  newName: string | null;
  originalUnit: string | null;
  newUnit: string | null;
  conversionRate: string | null;
}

export async function processMappingFile(file: File, columnMap: ColumnMap): Promise<Map<string, Mapping>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (!e.target?.result) {
        return reject(new Error("Không thể đọc tệp."));
      }
      try {
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const json = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as string[][];

        if (json.length < 2) {
            resolve(new Map());
            return;
        }

        const headers = json[0];
        const dataRows = json.slice(1);
        
        const getIndex = (key: keyof ColumnMap) => {
          const colName = columnMap[key];
          // Return -1 if column name is null or not found
          return colName ? headers.indexOf(colName) : -1;
        };

        const idx = {
          supplierTaxCode: getIndex('supplierTaxCode'),
          xmlCode: getIndex('xmlCode'),
          newCode: getIndex('newCode'),
          newName: getIndex('newName'),
          originalUnit: getIndex('originalUnit'),
          newUnit: getIndex('newUnit'),
          conversionRate: getIndex('conversionRate'),
        };

        if (idx.xmlCode === -1 || idx.newCode === -1) {
            throw new Error("Thiếu cột bắt buộc. Vui lòng chọn cột cho 'Mã hàng XML' và 'Mã ánh xạ mới'.");
        }

        const mapping = new Map<string, Mapping>();
        
        for (const row of dataRows) {
          const xmlCodeRaw = String(row[idx.xmlCode]).trim();
          if (!xmlCodeRaw) continue;

          const newCode = String(row[idx.newCode]).trim();
          if (!newCode) continue;
          
          const supplierTaxCode = idx.supplierTaxCode !== -1 ? String(row[idx.supplierTaxCode]).trim() : undefined;

          // The document ID is either combined (specific) or just the item code (generic)
          const docId = supplierTaxCode && supplierTaxCode.length > 0
            ? createCombinedId(supplierTaxCode, xmlCodeRaw)
            : sanitizeDocId(xmlCodeRaw);

          const newName = idx.newName > -1 ? String(row[idx.newName]).trim() : '';
          const originalUnit = idx.originalUnit > -1 ? String(row[idx.originalUnit]).trim() : '';
          const newUnit = idx.newUnit > -1 ? String(row[idx.newUnit]).trim() : originalUnit;
          const rateString = idx.conversionRate > -1 ? String(row[idx.conversionRate]).replace(',', '.') : '1';
          const conversionRate = parseFloat(rateString);

          mapping.set(docId, {
            id: docId,
            originalCode: xmlCodeRaw,
            // Only include supplierTaxCode if it exists and is not an empty string
            ...(supplierTaxCode && supplierTaxCode.length > 0 && { supplierTaxCode }),
            newCode,
            originalName: newName, // In import, originalName is same as newName
            newName,
            originalUnit,
            newUnit,
            conversionRate: !isNaN(conversionRate) ? conversionRate : 1,
          });
        }
        resolve(mapping);
      } catch (error: any) {
        reject(new Error(error.message || "Lỗi khi phân tích cú pháp tệp Excel. Hãy chắc chắn rằng nó có định dạng đúng."));
      }
    };
    reader.onerror = () => {
        reject(new Error("Không thể đọc tệp."));
    };
    reader.readAsArrayBuffer(file);
  });
}
