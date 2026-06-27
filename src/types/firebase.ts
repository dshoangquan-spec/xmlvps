

export interface Mapping {
  id: string; // Document ID. Can be `itemCode` (generic) or `taxCode-itemCode` (specific).
  originalCode: string; // The original item code from XML, not santized.
  supplierTaxCode?: string; // The supplier's tax code. Undefined for generic rules.
  newCode: string;
  originalName: string; // The original item name from XML. Should not be changed.
  newName: string; // The new name to be mapped. Can be edited by the user.
  originalUnit?: string;
  newUnit: string;
  conversionRate: number;
  masterCatalogId?: string;
}

export interface CommunityMapping {
  id: string; // Composite key, same as Mapping's id
  originalCode: string;
  supplierTaxCode?: string;
  newCode: string; // The internal code suggested by the user who contributed this mapping.
  newName: string;
  newUnit: string;
  conversionRate: number;
  updateCount: number; // How many times this mapping has been confirmed or updated.
  masterCatalogId?: string; // The linked ID from the master product catalog. Editable by Admin.
}

export interface Supplier {
  id: string; // Tax ID, used as document ID
  supplierCode: string;
  supplierName: string;
}

export interface User {
  id: string; // Firestore document ID
  username: string;
  password?: string; // Should not be sent to client
  fullName: string;
  role: 'ADMIN' | 'USER';
  createdAt?: string;
}

export interface MasterCatalogItem {
  id: string; // Unique product code (Mã SP), used as document ID
  productName: string;
  activeIngredient: string;
  concentration: string;
  registrationNumber: string;
  packaging: string;
  unit: string; // Original unit
  smallestUnit?: string; // Smallest unit after conversion
  conversionRate?: number; // Conversion rate from original unit to smallest unit
}

export interface PharmacyAccount {
  id: string;
  pharmacyName: string;
  representative?: string;
  usageStartDate?: string; // Date string 'yyyy-MM-dd'
  softwareFee?: number;
  softwareFeeDate?: string; // Date string 'yyyy-MM-dd'
  pmName?: string;
  pmUser?: string;
  pmPass?: string;
  invoiceProviderName?: string;
  invoiceUser?: string;
  invoicePass?: string;
  invoiceLink?: string;
  taxUser?: string;
  taxPass?: string;
  electronicTaxUser?: string;
  electronicTaxPass?: string;
  electronicTaxLink?: string;
}

export interface FeeRecord {
  id: string; // e.g., '2024-07'
  month: string; // Format: 'yyyy-MM'
  taxReportFee: number;
  invoiceImportFee: number;
  invoiceExportFee: number;
  totalFee: number;
  isPaid: boolean;
}

export interface TaxReport {
  id: string; // e.g., '2024-Q3'
  pharmacyAccountId: string;
  userId: string;
  year: number;
  quarter: number;
  openingBalance: number;
  purchaseValue: number;
  revenue: number;
  costOfGoods: number;
  closingBalance: number;
  vatPayable: number;
  pitPayable: number;
  status: 'DRAFT' | 'SUBMITTED';
  createdAt: any; // Can be FieldValue for new, or string for existing
  updatedAt: any; // Can be FieldValue
}


export interface ImportSession {
  id: string;
  userId: string;
  importDate: string; // ISO string
  fileNames: string[];
  invoiceCount: number;
  itemCount: number;
}

export interface Invoice {
  id: string; // invoiceNumber
  uniqueIdentifier?: string; // Combination of number, date, and tax code for duplicate checks
  importSessionId: string;
  provider: string;
  invoiceDate: string;
  sellerName: string;
  sellerTaxCode: string;
  sellerAddress: string;
  buyerName: string;
  fileName: string;
  portalLink?: string;
  accessCode?: string;
}

export interface InvoiceItem {
  id: string;
  userId: string; // Denormalized for collectionGroup queries
  invoiceId: string;
  invoiceDate: string; // Denormalized for collectionGroup queries
  invoiceDateISO: string; // Denormalized, in YYYY-MM-DD format for range queries
  sellerName: string; // Denormalized for collectionGroup queries
  lineNumber: string;
  itemCode: string;
  itemName: string;
  manufacturer?: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  taxRate: string;
  lotNumber?: string;
  expirationDate?: string;
}

// This type is used for items that are being processed in the UI
// It combines the original invoice data with the mapping data
export interface ProcessingItem extends Mapping {
  // This interface inherits all properties from Mapping
  // and can be extended with any other properties needed during processing
}

export interface Version {
    id: string;
    versionNumber: string;
    releaseDate: string; // ISO string format
    published: boolean;
}

export interface Change {
    id: string;
    versionId: string;
    type: 'new' | 'improvement' | 'fix';
    text: string;
    adminOnly: boolean;
    order: number;
}
