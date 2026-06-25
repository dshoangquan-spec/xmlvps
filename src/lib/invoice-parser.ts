'use client';
import { format, parse, isValid } from 'date-fns';
import type { InvoiceItem } from '@/types/invoice';

const getText = (element: Element | Document | null, selector: string) => element?.querySelector(selector)?.textContent?.trim() ?? '';
const sanitizeDocId = (id: string) => id.replace(/\//g, '-');

function detectProvider(xmlDoc: Document): 'VNPT_or_MeInvoice' | 'Viettel' | 'Unknown' {
    if (xmlDoc.querySelector("HHDVu")) {
        return "VNPT_or_MeInvoice";
    } else if (xmlDoc.querySelector("Invoice") && xmlDoc.querySelector("Item")) {
        return "Viettel";
    } else {
        return "Unknown";
    }
}

function formatHsdd(hsdd: string): string {
    if (!hsdd || hsdd.trim() === '') return '';
    let formattedHsdd = hsdd.trim();

    if (formattedHsdd.includes('|')) {
        formattedHsdd = formattedHsdd.split('|')[0];
    }
    
    // Xử lý định dạng có chứa giờ T00:00:00
    if (formattedHsdd.includes('T')) {
        formattedHsdd = formattedHsdd.split('T')[0];
    }

    const cleaned = formattedHsdd.replace(/\D/g, ''); 

    if (cleaned.length === 6) {
        try {
            const parsedDate = parse(cleaned, 'ddMMyy', new Date());
            if (!isNaN(parsedDate.getTime())) {
                const currentYear = new Date().getFullYear();
                let fullYear = parsedDate.getFullYear();
                if (fullYear < currentYear - 80) fullYear += 100;
                parsedDate.setFullYear(fullYear);
                return format(parsedDate, 'dd/MM/yyyy');
            }
        } catch (e) { }
    }
    if (cleaned.length === 8) {
        try {
            const d1 = parse(cleaned, 'ddMMyyyy', new Date());
            if (!isNaN(d1.getTime())) return format(d1, 'dd/MM/yyyy');
        } catch (e) { }
        try {
            const d2 = parse(cleaned, 'yyyyMMdd', new Date());
            if (!isNaN(d2.getTime())) return format(d2, 'dd/MM/yyyy');
        } catch (e) { }
    }

    const commonFormats = ["dd/MM/yyyy", "dd.MM.yyyy", "dd-MM-yyyy", "dd/MM/yy", "dd.MM.yy", "dd-MM-yy", "yyyy-MM-dd", "yyyy/MM/dd"];
    for (const fmt of commonFormats) {
        try {
             const parsedDate = parse(formattedHsdd, fmt, new Date());
             if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1970) {
                return format(parsedDate, 'dd/MM/yyyy');
             }
        } catch (e) { }
    }

    return hsdd; 
}

function splitCombinedSoloHsdd(val: string): [string, string] {
    val = val.trim();
    // Try to split by common separators first: space-hyphen-space, semicolon, slash, vertical bar, tab
    const separators = [/\s+-\s+/, /\s+–\s+/, /;/, /\|/, /\s+/];
    for (const sep of separators) {
        const parts = val.split(sep).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return [parts[0], parts[1]];
        }
    }

    // If it's a single hyphen or dash/en-dash, e.g. "131225-29.12.2028" or "131225–29.12.2028"
    const dashIndex = val.search(/[-–]/);
    if (dashIndex !== -1) {
        const parts = val.split(/[-–]/);
        if (parts.length === 2) {
            return [parts[0].trim(), parts[1].trim()];
        } else if (parts.length > 2) {
            // Check if it ends with yyyy-mm-dd (last 3 parts)
            const lastThree = parts.slice(-3);
            if (lastThree.every(p => /^\d+$/.test(p.trim()))) {
                const datePart = lastThree.join('-');
                const lotPart = parts.slice(0, -3).join('-');
                return [lotPart.trim(), datePart.trim()];
            }
            // Otherwise, split at the first dash
            return [val.slice(0, dashIndex).trim(), val.slice(dashIndex + 1).trim()];
        }
    }

    return [val, ""];
}

function postProcessRows(rows: InvoiceItem[]): InvoiceItem[] {
    for (let i = 1; i < rows.length; i++) {
        const currentRow = rows[i];
        const prevRow = rows[i - 1];
        
        const isInfoOrDiscountRow = currentRow["Số lượng"] === 0 || 
                                    currentRow["Tên hàng hóa"].trim() === "" || 
                                    currentRow["Tên hàng hóa"].trim() === "()" ||
                                    currentRow["ĐVT"].toLowerCase().includes("ck") || 
                                    currentRow["Tên hàng hóa"].toLowerCase().includes("chiết khấu");
                                    
        if (isInfoOrDiscountRow) {
            if (currentRow["Số lô"] && currentRow["Số lô"] !== "Null" && (!prevRow["Số lô"] || prevRow["Số lô"] === "Null")) {
                prevRow["Số lô"] = currentRow["Số lô"];
            }
            if (currentRow["Hạn dùng"] && (!prevRow["Hạn dùng"] || prevRow["Hạn dùng"] === "")) {
                prevRow["Hạn dùng"] = currentRow["Hạn dùng"];
            }
        }
    }
    return rows;
}

function extractSoloHsdd(item: Element): [string, string] {
    const ttinMap = new Map<string, string>();
    const allTins = Array.from(item.querySelectorAll("TTin")); 

    for (const ttin of allTins) {
        const key = getText(ttin, "TTruong").toLowerCase();
        let val = getText(ttin, "DLieu");

        const dLieuTag = ttin.querySelector("DLieu");
        if (dLieuTag) {
            const sLoTag = dLieuTag.querySelector("SLo");
            if (sLoTag?.textContent) ttinMap.set('slo', sLoTag.textContent.trim());
            const hTTHangTag = dLieuTag.querySelector("HTTHang");
            if (hTTHangTag?.textContent) ttinMap.set('hdung', hTTHangTag.textContent.trim());
        }

        if (key && val && !ttinMap.has(key)) {
            ttinMap.set(key, val);
            
            // Check if key is a combined field containing both batch (số lô) and expiry (hạn dùng) info
            const keyNormalized = key.replace(/\s+/g, '');
            const isCombined = (keyNormalized.includes("sốlô") || keyNormalized.includes("solo") || keyNormalized.includes("lô")) && 
                               (keyNormalized.includes("hạndùng") || keyNormalized.includes("handung") || keyNormalized.includes("hsd"));
            if (isCombined) {
                const [splitSolo, splitHsdd] = splitCombinedSoloHsdd(val);
                if (splitSolo && !ttinMap.has('slo_combined')) {
                    ttinMap.set('slo_combined', splitSolo);
                }
                if (splitHsdd && !ttinMap.has('hdung_combined')) {
                    ttinMap.set('hdung_combined', splitHsdd);
                }
            }
        }
    }

    let solo = "";
    let hsdd = "";

    // Ưu tiên các trường External2 cho số lô và External3 cho hạn dùng
    const lotKeywords = ["external2", "slo", "lotno", "số lô", "so lo", "so_lo", "extra1", "extra01", "lot", "batchno", "customfield1detail", "cột 0", "slo_combined"];
    for (const k of lotKeywords) {
        if (ttinMap.has(k)) {
            const foundVal = ttinMap.get(k)!;
            if (foundVal && foundVal !== "0") {
                solo = foundVal;
                if (solo.startsWith("SLo=")) {
                    const match = solo.match(/SLo=([^|]+)/);
                    if (match) solo = match[1];
                }
                break;
            }
        }
    }
    
    const expKeywords = ["external3", "hdung", "hạn dùng", "hsd", "han_dung", "extra2", "expiry", "expirydate", "expiredate", "customfield2detail", "extra02", "cột 1", "hdung_combined"];
    for (const k of expKeywords) {
        if (ttinMap.has(k)) {
            const foundVal = ttinMap.get(k)!;
            if (foundVal) {
                hsdd = foundVal;
                break;
            }
        }
    }

    const combinedKeys = ['remark', 'extra', 'ttinkhac'];
    for (const k of combinedKeys) {
        if ((!solo || !hsdd) && ttinMap.has(k)) {
            const val = ttinMap.get(k)!;
            if (val.includes(';')) {
                const parts = val.split(';').map(p => p.trim());
                if (parts.length >= 2) {
                    if (!solo) solo = parts[0];
                    if (!hsdd) hsdd = parts[1];
                }
            }
        }
    }
    
    if (solo === "0") solo = "Null";

    return [solo, formatHsdd(hsdd)];
}

function extractFromItemName(tenHang: string): { name: string, solo: string, hsdd: string } {
    let solo = "";
    let hsdd = "";
    let cleanedName = tenHang;

    const lsxRegex = /\(LSX:([^;]+);HSD:([^\)]+)\)/i;
    const m1 = cleanedName.match(lsxRegex);
    if (m1) {
        solo = m1[1].trim();
        hsdd = m1[2].trim();
        cleanedName = cleanedName.replace(lsxRegex, '').trim();
    }

    const vnPharmaRegex = /(?:Số lô|So lo|Số lo|So lô|Lô):\s*([^;,\s]+)[\s,;\-–]*(?:Hạn dùng|Han dùng|Han dung|HSD|HSD:|EXP|HD):\s*([^;,\s\)]+)/i;
    const m2 = cleanedName.match(vnPharmaRegex);
    if (m2) {
        if (!solo) solo = m2[1].trim();
        if (!hsdd) hsdd = m2[2].trim();
        cleanedName = cleanedName.replace(vnPharmaRegex, '').trim();
    }

    const dmcRegex = /-(\d+)-(\d{6})-DMC/i;
    const m3 = cleanedName.match(dmcRegex);
    if (m3) {
        if (!solo) solo = m3[1].trim();
        if (!hsdd) hsdd = m3[2].trim();
        cleanedName = cleanedName.replace(dmcRegex, '').trim();
    }

    cleanedName = cleanedName
        .replace(/^[,\s;.\-+–]+|[,\s;.\-+–]+$/g, '')
        .replace(/\(\s*\)/g, '')
        .trim();

    return { name: cleanedName, solo, hsdd };
}

function processVnptOrMeInvoice(xmlDoc: Document, fileName: string): InvoiceItem[] {
    const nban = xmlDoc.querySelector("NBan");
    const ten_ncc = getText(nban, "Ten");
    const mst_ncc = getText(nban, "MST");
    const dia_chi_ncc = getText(nban, "DChi");
    const NMua = xmlDoc.querySelector("NMua");
    const ten_nha_thuoc = getText(NMua, "Ten");

    const [so_hd, ngay_hd] = getInvoiceInfo(xmlDoc);
    const [portal_link, fkey] = extractPortalFkey(xmlDoc);
    
    const TgTTTBSo = getText(xmlDoc, "TgTTTBSo");
    const totalAmountFromXml = parseFloat(TgTTTBSo) || 0;

    const TToan = xmlDoc.querySelector("TToan");
    let totalDiscountInvoice = parseFloat(getText(TToan, "TTCKTMai")) || 0;
    
    const invoiceItems = Array.from(xmlDoc.querySelectorAll("HHDVu"));
    
    if (totalDiscountInvoice === 0) {
        invoiceItems.forEach(item => {
            totalDiscountInvoice += parseFloat(getText(item, "STCKhau")) || 0;
        });
    }

    const rows: InvoiceItem[] = [];

    for (const item of invoiceItems) {
        let rawTenHang = getText(item, "THHDVu");
        let [solo, hsdd] = extractSoloHsdd(item);
        
        const fromName = extractFromItemName(rawTenHang);
        if (!solo) solo = fromName.solo;
        if (!hsdd) hsdd = formatHsdd(fromName.hsdd);
        let tenHang = fromName.name;

        if (solo === "0") solo = "Null";

        let maHang = getText(item, "MHHDVu");
        if (!maHang) maHang = sanitizeDocId(tenHang);

        const soLuong = parseFloat(getText(item, "SLuong")) || 0;
        const donGia = parseFloat(getText(item, "DGia")) || 0;
        const thanhTienRaw = parseFloat(getText(item, "ThTien")) || 0;
        const thueSuat = getText(item, "TSuat");
        const itemDiscount = parseFloat(getText(item, "STCKhau")) || 0;

        rows.push({
            "STT": getText(item, "STT"),
            "Mã hàng": maHang,
            "Tên hàng hóa": tenHang,
            "ĐVT": getText(item, "DVTinh"),
            "Số lượng": soLuong,
            "Đơn giá": donGia,
            "Thành tiền": thanhTienRaw,
            "Thuế suất": thueSuat,
            "Số lô": solo || "Null",
            "Hạn dùng": hsdd,
            "Số hóa đơn": so_hd,
            "Ngày hóa đơn": ngay_hd,
            "Nhà cung cấp": ten_ncc,
            "Mã số thuế": mst_ncc,
            "Địa chỉ": dia_chi_ncc,
            "Nhà thuốc": ten_nha_thuoc,
            "Tên file": fileName,
            "Link truy cập": portal_link,
            "Mã truy cập": fkey,
            "Tổng tiền thanh toán": totalAmountFromXml,
            "Tổng tiền chiết khấu": totalDiscountInvoice,
            "Chiết khấu dòng": itemDiscount,
        });
    }

    return postProcessRows(rows);
}

function processViettel(xmlDoc: Document, fileName: string): InvoiceItem[] {
    const ten_ncc = getText(xmlDoc, "SellerName");
    const mst_ncc = getText(xmlDoc, "SellerTaxCode");
    const dia_chi_ncc = getText(xmlDoc, "SellerAddress");
    const ten_nha_thuoc = getText(xmlDoc, "BuyerName");
    const so_hd = getText(xmlDoc, "InvoiceNumber");
    const ngay_hd_raw = getText(xmlDoc, "InvoiceIssuedDate");
    const ngay_hd = ngay_hd_raw ? format(new Date(ngay_hd_raw), 'dd/MM/yyyy') : "";

    const payment = xmlDoc.querySelector("Payment");
    const tongTienThanhToan = parseFloat(getText(payment, "TotalAmountWithTax")) || 0;
    const tongTienChietKhau = parseFloat(getText(payment, "DiscountAmount")) || 0;

    const rows: InvoiceItem[] = [];
    for (const item of Array.from(xmlDoc.querySelectorAll("Item"))) {
        let rawTenHang = getText(item, "ItemName");
        let [solo, hsdd] = extractSoloHsdd(item);
        
        const fromName = extractFromItemName(rawTenHang);
        if (!solo) solo = fromName.solo;
        if (!hsdd) hsdd = formatHsdd(fromName.hsdd);
        let tenHang = fromName.name;
        
        if (solo === "0") solo = "Null";

        let maHang = getText(item, "ItemCode");
        if (!maHang) maHang = sanitizeDocId(tenHang);
        
        const soLuong = parseFloat(getText(item, "Quantity")) || 0;
        const donGia = parseFloat(getText(item, "UnitPrice")) || 0;
        const thueSuat = getText(item, "TaxRate");
        const itemTotalAmountWithoutTax = parseFloat(getText(item, "ItemTotalAmountWithoutTax")) || 0;
        
        rows.push({
            "STT": getText(item, "LineNumber"),
            "Mã hàng": maHang,
            "Tên hàng hóa": tenHang,
            "ĐVT": getText(item, "UnitName"),
            "Số lượng": soLuong,
            "Đơn giá": donGia,
            "Thành tiền": itemTotalAmountWithoutTax,
            "Thuế suất": thueSuat,
            "Số lô": solo || "Null",
            "Hạn dùng": hsdd,
            "Số hóa đơn": so_hd,
            "Ngày hóa đơn": ngay_hd,
            "Nhà cung cấp": ten_ncc,
            "Mã số thuế": mst_ncc,
            "Địa chỉ": dia_chi_ncc,
            "Nhà thuốc": ten_nha_thuoc,
            "Tên file": fileName,
            "Link truy cập": "Không có",
            "Mã truy cập": "Không có",
            "Tổng tiền thanh toán": tongTienThanhToan,
            "Tổng tiền chiết khấu": tongTienChietKhau,
            "Chiết khấu dòng": parseFloat(getText(item, "DiscountAmount")) || 0,
        });
    }
    return postProcessRows(rows);
}

function extractPortalFkey(soup: Document): [string, string] {
    let portal = "";
    let fkey = "";

    for (const tag of Array.from(soup.querySelectorAll("TTin"))) {
        const key = getText(tag, "TTruong").toLowerCase();
        const val = getText(tag, "DLieu");
        
        if (!portal && (key.includes("portallink") || val.startsWith("http"))) {
            portal = val;
        }
        if (!fkey && (key.includes("fkey") || (key.includes("extra6") && val.length > 0 && val.length <= 10))) {
            fkey = val;
        }
    }
    return [portal || "Không có", fkey || "Không có"];
}

function getInvoiceInfo(soup: Document): [string, string] {
    const so_hd = getText(soup, "SHDon");
    const ngay_hd_raw = getText(soup, "NLap");
    try {
        const parsedDate = parse(ngay_hd_raw, 'yyyy-MM-dd', new Date());
        if (!isNaN(parsedDate.getTime())) {
            return [so_hd, format(parsedDate, 'dd/MM/yyyy')];
        }
    } catch(e) { }
    return [so_hd, ngay_hd_raw];
}

export async function processXmlFile(xmlContent: string, fileName: string): Promise<InvoiceItem[]> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
        throw new Error(`Lỗi phân tích cú pháp file: ${fileName}`);
    }

    const provider = detectProvider(xmlDoc);
    
    switch (provider) {
        case "VNPT_or_MeInvoice":
            return processVnptOrMeInvoice(xmlDoc, fileName);
        case "Viettel":
            return processViettel(xmlDoc, fileName);
        default:
            throw new Error(`Không nhận dạng được định dạng file: ${fileName}`);
    }
}