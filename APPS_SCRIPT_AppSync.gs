// =====================================================================
// FINAL 1-CLICK ALL 78 CLIENTS FOLDERS & ETSY MASTER STATEMENTS
// Clients Folder ID: 1_L9YfSkK_AUwKcKR5a31YPznkcyqO9VR
// Master File ID: 1_0fohl9ZOcB2-djEEhD_CpwOCzhJ2U_1bzcUS9x-Cmk
// =====================================================================

var CLIENTS_FOLDER_ID = '1_L9YfSkK_AUwKcKR5a31YPznkcyqO9VR';
var ETSY_MASTER_TEMPLATE_ID = '1_0fohl9ZOcB2-djEEhD_CpwOCzhJ2U_1bzcUS9x-Cmk';

// ---- HEADER-AWARE COLUMN LOOKUP (Har tab ke Row 1 headers se exact columns detect karta hai) ----
function cleanClientName(n) { return String(n || '').replace(/\*/g, '').trim().toUpperCase(); }

function colToLetter(colNum) {
  var n = Number(colNum) || 0;
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}

function getTabCols(sheet) {
  var cols = {
    sr: 0, client: 0, id: 0, gstin: 0, firm: 0, mobile: 0, rDate: 0,
    filed: 0, ptDate: 0, dueMon: 0, noticeStatus: 0, noticeDate: 0,
    rov: 0, gov: 0, reference: 0, address: 0, clientType: 0, status: 0,
    uid: 0, folderId: 0, statementId: 0, activeMonth: 0, password: 0,
    portalPeriod: 0, portalNoticesCount: 0, portalNotices: 0,
    gstr2bIgst: 0, gstr2bCgst: 0, gstr2bSgst: 0, gstr2bCess: 0, gstr2bIneligible: 0, gstr2bSuppliers: 0,
    ecomGross: 0, ecomNet: 0, ecomTcs: 0, ecomPlatforms: 0, b2bSellersJson: 0, ecoListJson: 0,
    gstr2bDriveLink: 0, portalUpdatedAt: 0, docCollected: 0, gstr2bStatus: 0, maxCol: 20
  };
  if (!sheet) return cols;
  var lastC = Math.max(sheet.getLastColumn(), 23);
  var hdrs = sheet.getRange(1, 1, 1, lastC).getDisplayValues()[0] || [];
  var recognized = 0;

  for (var c = 0; c < hdrs.length; c++) {
    var k = String(hdrs[c] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!k) continue;
    var col1 = c + 1;
    if (!cols.sr && (k === 'srno' || k === 'sr')) { cols.sr = col1; recognized++; }
    else if (!cols.client && (k === 'client' || k === 'name' || k === 'clientname')) { cols.client = col1; recognized++; }
    else if (!cols.id && (k === 'id' || k === 'portalid' || k === 'gstid')) { cols.id = col1; recognized++; }
    else if (!cols.gstin && (k === 'gstno' || k === 'gstin')) { cols.gstin = col1; recognized++; }
    else if (!cols.firm && (k === 'firm' || k === 'tradename' || k === 'firmname')) { cols.firm = col1; recognized++; }
    else if (!cols.mobile && (k === 'mobno' || k === 'mobile' || k === 'mobileno' || k === 'phone')) { cols.mobile = col1; recognized++; }
    else if (!cols.rDate && (k === 'rdate' || k === 'regdate' || k === 'registrationdate')) { cols.rDate = col1; recognized++; }
    else if (!cols.filed && (k === 'fillingstatus' || k === 'filingstatus' || k === 'filed')) { cols.filed = col1; recognized++; }
    else if (!cols.ptDate && (k === 'ptdate' || k === 'paidtill')) { cols.ptDate = col1; recognized++; }
    else if (!cols.dueMon && (k === 'duemon' || k === 'duemonths')) { cols.dueMon = col1; recognized++; }
    else if (!cols.noticeStatus && k === 'noticestatus') { cols.noticeStatus = col1; recognized++; }
    else if (!cols.noticeDate && k === 'noticedate') { cols.noticeDate = col1; recognized++; }
    else if (!cols.rov && (k === 'rov' || k.indexOf('rov') === 0 || k === 'returnonvalue' || k === 'returnvalue' || k.indexOf('returnon') === 0)) { cols.rov = col1; recognized++; }
    else if (!cols.gov && k === 'gov') { cols.gov = col1; recognized++; }
    else if (!cols.reference && (k === 'reference' || k === 'refrence' || k === 'ref' || k.indexOf('refer') === 0)) { cols.reference = col1; recognized++; }
    else if (!cols.address && (k === 'add' || k === 'address')) { cols.address = col1; recognized++; }
    else if (!cols.clientType && (k === 'etsyregular' || k === 'clienttype' || k === 'type' || (k.indexOf('etsy') > -1 && k.indexOf('reg') > -1))) { cols.clientType = col1; recognized++; }
    else if (!cols.status && (k === 'aciveinactivecl' || k === 'activeinactivecl' || k === 'status' || k.indexOf('inactive') > -1)) { cols.status = col1; recognized++; }
    else if (!cols.uid && (k === 'clientuid' || k === 'uid')) { cols.uid = col1; recognized++; }
    else if (!cols.folderId && k === 'folderid') { cols.folderId = col1; recognized++; }
    else if (!cols.statementId && k === 'statementid') { cols.statementId = col1; recognized++; }
    else if (!cols.activeMonth && k === 'activemonth') { cols.activeMonth = col1; recognized++; }
    else if (!cols.password && (k === 'password' || k === 'portalpassword' || k === 'gstpassword' || k === 'pass' || k === 'pwd')) { cols.password = col1; recognized++; }
    else if (!cols.portalPeriod && k === 'portalperiod') { cols.portalPeriod = col1; recognized++; }
    else if (!cols.portalNoticesCount && (k === 'portalnoticescount' || k === 'noticescount')) { cols.portalNoticesCount = col1; recognized++; }
    else if (!cols.portalNotices && (k === 'portalnotices' || k === 'noticessummary')) { cols.portalNotices = col1; recognized++; }
    else if (!cols.gstr2bIgst && k === 'gstr2bigst') { cols.gstr2bIgst = col1; recognized++; }
    else if (!cols.gstr2bCgst && k === 'gstr2bcgst') { cols.gstr2bCgst = col1; recognized++; }
    else if (!cols.gstr2bSgst && k === 'gstr2bsgst') { cols.gstr2bSgst = col1; recognized++; }
    else if (!cols.gstr2bCess && k === 'gstr2bcess') { cols.gstr2bCess = col1; recognized++; }
    else if (!cols.gstr2bIneligible && k === 'gstr2bineligible') { cols.gstr2bIneligible = col1; recognized++; }
    else if (!cols.gstr2bSuppliers && k === 'gstr2bsuppliers') { cols.gstr2bSuppliers = col1; recognized++; }
    else if (!cols.ecomGross && (k === 'ecomgross' || k === 'ecomgrosstaxable')) { cols.ecomGross = col1; recognized++; }
    else if (!cols.ecomNet && (k === 'ecomnet' || k === 'ecomnetvalue')) { cols.ecomNet = col1; recognized++; }
    else if (!cols.ecomTcs && (k === 'ecomtcs' || k === 'ecomtotaltcs')) { cols.ecomTcs = col1; recognized++; }
    else if (!cols.ecomPlatforms && k === 'ecomplatforms') { cols.ecomPlatforms = col1; recognized++; }
    else if (!cols.b2bSellersJson && k === 'gstr2bb2bjson') { cols.b2bSellersJson = col1; recognized++; }
    else if (!cols.ecoListJson && k === 'ecomlistjson') { cols.ecoListJson = col1; recognized++; }
    else if (!cols.gstr2bDriveLink && k === 'gstr2bdrivelink') { cols.gstr2bDriveLink = col1; recognized++; }
    else if (!cols.portalUpdatedAt && k === 'portalupdatedat') { cols.portalUpdatedAt = col1; recognized++; }
    else if (!cols.docCollected && k === 'doccollected') { cols.docCollected = col1; recognized++; }
    else if (!cols.gstr2bStatus && k === 'gstr2bstatus') { cols.gstr2bStatus = col1; recognized++; }
  }

  if (recognized < 3) {
    // Legacy 23-column fallback sirf tab jab Row 1 headers khali hon
    cols.sr = 1; cols.client = 2; cols.id = 3; cols.gstin = 4; cols.firm = 5;
    cols.mobile = 6; cols.rDate = 7; cols.filed = 8; cols.ptDate = 9; cols.dueMon = 10;
    cols.noticeStatus = 11; cols.noticeDate = 12; cols.rov = 13; cols.gov = 14;
    cols.reference = 15; cols.address = 16; cols.clientType = 17; cols.status = 18;
    cols.uid = 20; cols.folderId = 21; cols.statementId = 22; cols.activeMonth = 23;
  } else {
    if (!cols.sr) cols.sr = 1;
    if (!cols.client) cols.client = 2;
    if (!cols.id) cols.id = 3;
    if (!cols.gstin) cols.gstin = 4;
    if (!cols.firm) cols.firm = 5;
    if (!cols.mobile) cols.mobile = 6;
    if (!cols.rDate) cols.rDate = 7;
    if (!cols.filed) cols.filed = 8;
    if (!cols.ptDate) cols.ptDate = 9;
    if (!cols.dueMon) cols.dueMon = 10;
    if (!cols.noticeStatus) cols.noticeStatus = 11;
    if (!cols.noticeDate) cols.noticeDate = 12;
  }

  cols.maxCol = Math.max(
    lastC, cols.sr, cols.client, cols.id, cols.gstin, cols.firm, cols.mobile,
    cols.rDate, cols.filed, cols.ptDate, cols.dueMon, cols.noticeStatus, cols.noticeDate,
    cols.rov, cols.gov, cols.reference, cols.address, cols.clientType, cols.status,
    cols.uid, cols.folderId, cols.statementId, cols.activeMonth, cols.password,
    cols.portalPeriod, cols.portalNoticesCount, cols.portalNotices,
    cols.gstr2bIgst, cols.gstr2bCgst, cols.gstr2bSgst, cols.gstr2bCess, cols.gstr2bIneligible, cols.gstr2bSuppliers,
    cols.ecomGross, cols.ecomNet, cols.ecomTcs, cols.ecomPlatforms, cols.b2bSellersJson, cols.ecoListJson,
    cols.gstr2bDriveLink, cols.portalUpdatedAt, cols.docCollected
  );
  return cols;
}

function ensurePasswordColumn(sheet, cols) {
  if (!sheet) return 0;
  if (cols.password > 0) return cols.password;
  var newCol = Math.max(sheet.getLastColumn(), cols.maxCol || 0) + 1;
  sheet.getRange(1, newCol).setValue('Password').setFontWeight('bold').setBackground('#e2e8f0').setFontColor('#0f172a');
  cols.password = newCol;
  cols.maxCol = Math.max(cols.maxCol || 0, newCol);
  return newCol;
}

function ensurePortalColumns(sheet, cols) {
  if (!sheet) return cols;
  var defs = [
    ['portalPeriod', 'Portal_Period'],
    ['portalNoticesCount', 'Portal_Notices_Count'],
    ['portalNotices', 'Portal_Notices'],
    ['gstr2bIgst', 'GSTR2B_IGST'],
    ['gstr2bCgst', 'GSTR2B_CGST'],
    ['gstr2bSgst', 'GSTR2B_SGST'],
    ['gstr2bCess', 'GSTR2B_Cess'],
    ['gstr2bIneligible', 'GSTR2B_Ineligible'],
    ['gstr2bSuppliers', 'GSTR2B_Suppliers'],
    ['ecomGross', 'ECom_Gross'],
    ['ecomNet', 'ECom_Net'],
    ['ecomTcs', 'ECom_TCS'],
    ['ecomPlatforms', 'ECom_Platforms'],
    ['b2bSellersJson', 'GSTR2B_B2B_JSON'],
    ['ecoListJson', 'ECom_List_JSON'],
    ['gstr2bDriveLink', 'GSTR2B_Drive_Link'],
    ['portalUpdatedAt', 'Portal_Updated_At'],
    ['docCollected', 'Doc_Collected'],
    ['gstr2bStatus', 'GSTR2B_Status']
  ];
  var nextCol = Math.max(sheet.getLastColumn(), cols.maxCol || 0);
  for (var i = 0; i < defs.length; i++) {
    var key = defs[i][0];
    var title = defs[i][1];
    if (!cols[key] || cols[key] <= 0) {
      nextCol++;
      sheet.getRange(1, nextCol).setValue(title).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
      cols[key] = nextCol;
      cols.maxCol = Math.max(cols.maxCol || 0, nextCol);
    }
  }
  if (cols.docCollected > 0 && sheet.getLastRow() >= 2) {
    var docRange = sheet.getRange(2, cols.docCollected, sheet.getLastRow() - 1, 1);
    var rules = docRange.getDataValidations();
    var needsChk = false;
    for (var ri = 0; ri < rules.length; ri++) {
      if (!rules[ri][0] || rules[ri][0].getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
        needsChk = true; break;
      }
    }
    if (needsChk) docRange.insertCheckboxes();
  }
  return cols;
}

function findClientRow(clientName, category) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var want = cleanClientName(clientName);
  if (!want) return null;
  var tabs = category ? [category] : ['PAID CLINTS', 'Apne'];
  for (var t = 0; t < tabs.length; t++) {
    var sheet = ss.getSheetByName(tabs[t]);
    if (!sheet || sheet.getLastRow() < 2) continue;
    var cols = getTabCols(sheet);
    var names = sheet.getRange(1, cols.client, sheet.getLastRow(), 1).getValues();
    for (var i = 1; i < names.length; i++) {
      if (cleanClientName(names[i][0]) === want) return { sheet: sheet, row: i + 1, cols: cols };
    }
  }
  return null;
}

// Folder: pehle FOLDER ID column se, ID na ho to naam se dhoondh kar ID sheet me likh deta hai
function getClientFolder(clientName, category, createIfMissing) {
  var loc = findClientRow(clientName, category);
  var folder = null;
  if (loc && loc.cols.folderId > 0) {
    var id = String(loc.sheet.getRange(loc.row, loc.cols.folderId).getValue() || '').trim();
    if (id) { try { var fx = DriveApp.getFolderById(id); if (!fx.isTrashed()) folder = fx; } catch (e) {} }
  }
  if (!folder) folder = findClientFolder(clientName);
  if (!folder && createIfMissing) {
    folder = DriveApp.getFolderById(CLIENTS_FOLDER_ID).createFolder(String(clientName).replace(/\*/g, '').trim());
  }
  if (folder && loc && loc.cols.folderId > 0) loc.sheet.getRange(loc.row, loc.cols.folderId).setValue(folder.getId());
  return folder;
}

/* ===================== GST CERTIFICATE FOLDER → NAYE CLIENTS (one click) =====================
 * Folder: My Drive me "GST Certificates" (ya Script Property GST_CERT_FOLDER_ID).
 * GSTIN: pehle FILE NAME se (100% sahi), na mile to Drive OCR se PDF/photo ke andar se.
 * Jo GSTIN pehle se Sheet (PAID CLINTS / Apne) me hai use SKIP kiya jata hai.
 * Sirf padhta hai — koi client apne aap add nahi hota; app preview dikha kar Add dabati hai.
 */
var GST_CERT_FOLDER_NAME = 'GST Certificates';

var GST_STATE_NAMES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh (old)',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory'
};

// SIRF EK FIXED FOLDER — kisi doosre folder me jhaankte hi nahi.
//   1) Script Property GST_CERT_FOLDER_ID (ek baar set ho gaya to hamesha wahi)
//   2) warna My Drive me exact naam "GST Certificates"
// Milne par ID yaad rakh li jati hai (agli baar seedha wahi, naam badle to bhi chalega).
function gstCertFolderIdFromLink_(v) {
  var str = String(v || '').trim();
  if (!str) return '';
  var m = str.match(/[-_A-Za-z0-9]{25,}/);
  return m ? m[0] : '';
}

function gstCertFolder_() {
  var props = null;
  try { props = PropertiesService.getScriptProperties(); } catch (e) {}

  var savedId = '';
  if (props) { try { savedId = String(props.getProperty('GST_CERT_FOLDER_ID') || '').trim(); } catch (e) {} }
  if (savedId) {
    try { var f = DriveApp.getFolderById(savedId); if (f && !f.isTrashed()) return { folder: f, how: 'saved id' }; } catch (e) {}
  }

  try {
    var it = DriveApp.getFoldersByName(GST_CERT_FOLDER_NAME);
    while (it.hasNext()) {
      var f2 = it.next();
      if (f2.isTrashed()) continue;
      if (props) { try { props.setProperty('GST_CERT_FOLDER_ID', f2.getId()); } catch (e) {} }
      return { folder: f2, how: 'naam se mila' };
    }
  } catch (e) {}

  return { folder: null, how: '' };
}

// App se folder ka link/ID set karna (Shared Drive ka folder ho to yahi rasta)
function setGstCertFolder(data) {
  var id = gstCertFolderIdFromLink_((data && (data.folderLink || data.folderId || data.folder)) || '');
  if (!id) return { status: 'error', message: "Folder ka link ya ID samajh nahi aaya. Drive me folder kholiye → link copy kariye → dobara try kariye." };
  var f = null;
  try { f = DriveApp.getFolderById(id); } catch (e) {}
  if (!f || f.isTrashed()) return { status: 'error', message: "Is link ka folder nahi mila. Check kariye ki folder aapke hi Drive me hai (Shared Drive ho to bhi chalega)." };
  try { PropertiesService.getScriptProperties().setProperty('GST_CERT_FOLDER_ID', f.getId()); } catch (e) {}
  return { status: 'ok', folder: f.getName(), folderId: f.getId(), folderUrl: f.getUrl(), message: "Folder set ho gaya: " + f.getName() };
}

function gstCertFiles_(folder) {
  var out = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var nm = String(f.getName() || '');
    var mt = String(f.getMimeType() || '');
    if (mt === 'application/pdf' || /\.pdf$/i.test(nm) || /^image\//.test(mt) || /\.(jpe?g|png)$/i.test(nm)) out.push(f);
  }
  return out;
}

function gstGstinClean_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function gstGstinFromText_(text) {
  var m = String(text || '').toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/);
  return m ? m[0] : '';
}

function gstGstinChecksumOk_(gstin) {
  var g = gstGstinClean_(gstin);
  if (g.length !== 15) return false;
  var code = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var sum = 0;
  for (var i = 0; i < 14; i++) {
    var v = code.indexOf(g.charAt(i));
    if (v < 0) return false;
    var f = v * ((i % 2 === 0) ? 1 : 2);
    sum += Math.floor(f / 36) + (f % 36);
  }
  return code.charAt((36 - (sum % 36)) % 36) === g.charAt(14);
}

function gstCertOcrAvailable_() {
  return !!(typeof Drive !== 'undefined' && Drive && Drive.Files && Drive.Files.copy);
}

// PDF/photo ko Google Doc me convert + OCR. Do raste:
//   1) Drive advanced service (agar on hai) — sabse simple
//   2) OAuth token + Drive v2 REST — koi service enable karne ki zaroorat NAHI (default me chalta hai)
function gstCertCopyToDocWithOcr_(fileId) {
  var title = 'gst_ocr_' + fileId + '_' + Date.now();
  if (gstCertOcrAvailable_()) {
    try {
      var created = Drive.Files.copy({ title: title }, fileId, { convert: true, ocr: true });
      if (created && created.id) return created.id;
    } catch (e) {}
  }
  try {
    var url = 'https://www.googleapis.com/drive/v2/files/' + encodeURIComponent(fileId) + '/copy?convert=true&ocr=true&fields=id';
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ title: title }),
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      var j = JSON.parse(res.getContentText() || '{}');
      if (j && j.id) return j.id;
    }
  } catch (e) {}
  return '';
}

function gstCertDeleteQuietly_(docId) {
  if (!docId) return;
  try { DriveApp.getFileById(docId).setTrashed(true); return; } catch (e) {}
  try { Drive.Files.remove(docId); return; } catch (e2) {}
  try {
    UrlFetchApp.fetch('https://www.googleapis.com/drive/v2/files/' + encodeURIComponent(docId), {
      method: 'delete',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
  } catch (e3) {}
}

function gstCertTextByOcr_(fileId) {
  var docId = gstCertCopyToDocWithOcr_(fileId);
  if (!docId) return '';
  try {
    var doc = DocumentApp.openById(docId);
    var txt = doc.getBody().getText() || '';
    try { doc.saveAndClose(); } catch (e) {}
    return txt;
  } catch (e) {
    return '';
  } finally {
    gstCertDeleteQuietly_(docId);
  }
}

function gstCertMonthName_(m) {
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var i = Number(m) - 1;
  return (i >= 0 && i < 12) ? names[i] : '';
}

function gstCertDate_(text) {
  var t = String(text || '');
  var m = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (m) {
    var mon = gstCertMonthName_(m[2]);
    if (mon) return ('0' + m[1]).slice(-2) + '-' + mon + '-' + m[3];
  }
  var m2 = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m2) {
    var mon2 = gstCertMonthName_(m2[2]);
    if (mon2) return ('0' + m2[3]).slice(-2) + '-' + mon2 + '-' + m2[1];
  }
  return '';
}

// "Legal Name" ke aage wali value (same line ya agli line)
function gstCertLineAfter_(lines, re) {
  for (var i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      var after = String(lines[i]).replace(re, '').replace(/^[\s:.\-]+/, '').trim();
      if (after.length >= 2 && !/^(name|of|business)$/i.test(after)) return after;
      for (var j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        var nxt = String(lines[j] || '').trim();
        if (nxt) return nxt;
      }
    }
  }
  return '';
}

function gstCertCleanName_(v) {
  return String(v || '').replace(/[|]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s:.,\-]+|[\s:.,\-]+$/g, '').slice(0, 80);
}

function parseGstCertText_(text) {
  var raw = String(text || '');
  var lines = raw.split(/\r?\n/).map(function (x) { return String(x).replace(/\s+/g, ' ').trim(); }).filter(function (x) { return !!x; });
  var legal = gstCertCleanName_(gstCertLineAfter_(lines, /legal\s*name(\s*of\s*business)?/i));
  var trade = gstCertCleanName_(gstCertLineAfter_(lines, /trade\s*name/i));
  if (/^[-–—.]+$/.test(trade)) trade = '';

  // Address: "Principal Place of Business" ke baad ki 2-3 lines
  var addr = '';
  for (var i = 0; i < lines.length; i++) {
    if (/principal\s+place\s+of\s+business/i.test(lines[i])) {
      var parts = [];
      var same = lines[i].replace(/principal\s+place\s+of\s+business/i, '').replace(/^[\s:.\-]+/, '').trim();
      if (same) parts.push(same);
      for (var j = i + 1; j < Math.min(lines.length, i + 5) && parts.join(' ').length < 160; j++) {
        var L = lines[j];
        if (/^(date|period|valid|gstin|registration|type\s+of\s+registration|particulars|address\s+of)/i.test(L)) break;
        parts.push(L);
      }
      addr = gstCertCleanName_(parts.join(', ')).slice(0, 200);
      break;
    }
  }

  var regDate = gstCertDate_(gstCertLineAfter_(lines, /(date\s+of\s+registration|registration\s+date)/i)) || gstCertDate_(raw);
  var gstin = gstGstinFromText_(raw);
  return {
    gstin: gstin,
    client: legal || trade,
    firm: trade || legal,
    address: addr,
    rDate: regDate
  };
}

// Filename se client/firm ka andaza (GSTIN hata kar)
function gstCertNameFromFileName_(name) {
  var n = String(name || '').replace(/\.(pdf|jpe?g|png)$/i, '');
  // pehle separators normalise karo (underscore ki wajah se \b word-boundary fail hota tha)
  n = n.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');
  n = n.replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/ig, ' ');
  n = n.replace(/\b(gst|certificate|certificates|certficate|registration|reg|regn|copy|new|final|scan|scanned|paper|document|doc|pdf|jpg|jpeg|png)\b/ig, ' ');
  n = n.replace(/\b\d{2,}\b/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();
  return gstCertCleanName_(n).toUpperCase();
}

function existingClientKeys_(ss) {
  var gstins = {}, names = {};
  ['PAID CLINTS', 'Apne'].forEach(function (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh || sh.getLastRow() < 2) return;
    var cols = getTabCols(sh);
    var vals = sh.getDataRange().getDisplayValues();
    for (var i = 1; i < vals.length; i++) {
      if (cols.gstin > 0) {
        var g = gstGstinClean_(vals[i][cols.gstin - 1]);
        if (g) gstins[g] = true;
      }
      if (cols.client > 0) {
        var nm = cleanClientName(vals[i][cols.client - 1]);
        if (nm) names[nm] = true;
      }
      if (cols.firm > 0) {
        var fm = cleanClientName(vals[i][cols.firm - 1]);
        if (fm) names[fm] = true;
      }
    }
  });
  return { gstins: gstins, names: names };
}

function scanGstCertFolder(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var resolved = gstCertFolder_();
  var folder = resolved.folder;
  if (!folder) {
    return {
      status: 'error',
      code: 'folder_not_found',
      message: "My Drive me '" + GST_CERT_FOLDER_NAME + "' folder nahi mila. Ek baar folder bana lijiye (naam bilkul '" + GST_CERT_FOLDER_NAME + "'), ya folder ka link paste kar dein — phir hamesha wahi folder use hoga, kisi doosre folder me nahi dekhega."
    };
  }
  var folderUrl = '';
  try { folderUrl = folder.getUrl(); } catch (e) {}
  var existing = existingClientKeys_(ss);
  var files = gstCertFiles_(folder);
  var candidates = [], skipped = [], errors = [];
  var ocrUsed = 0, ocrTried = 0;
  var seenGstin = {};
  var max = Math.min(files.length, 300);

  for (var i = 0; i < max; i++) {
    var f = files[i];
    var fileName = f.getName();
    try {
      var gstin = gstGstinFromText_(fileName);
      var source = gstin ? 'filename' : '';
      var parsed = { gstin: gstin, client: '', firm: '', address: '', rDate: '' };

      // File name me GSTIN hai to naam bhi wahin se; warna OCR
      if (gstin) {
        var guess = gstCertNameFromFileName_(fileName);
        if (guess) { parsed.client = guess; parsed.firm = guess; }
        // naam nahi mila to OCR se naam nikalne ki koshish
        if (!parsed.client && gstCertOcrAvailable_()) {
          ocrTried++;
          var t0 = gstCertTextByOcr_(f.getId());
          if (t0) { ocrUsed++; var p0 = parseGstCertText_(t0); parsed.client = p0.client; parsed.firm = p0.firm; parsed.address = p0.address; parsed.rDate = parsed.rDate || p0.rDate; }
        }
      } else if (gstCertOcrAvailable_()) {
        ocrTried++;
        var txt = gstCertTextByOcr_(f.getId());
        if (txt) {
          ocrUsed++;
          parsed = parseGstCertText_(txt);
          gstin = parsed.gstin;
          if (gstin && !source) source = 'ocr';
        }
      }

      gstin = gstGstinClean_(gstin);
      if (!gstin) {
        skipped.push({ fileName: fileName, reason: 'GSTIN nahi mila — file ka naam GSTIN se rakhein (jaise 09FNZPM7904J1ZY_Nam.pdf), ya OCR wali file saaf scan karein' });
        continue;
      }
      if (existing.gstins[gstin] || seenGstin[gstin]) {
        skipped.push({ fileName: fileName, gstin: gstin, reason: 'Pehle se list me hai' });
        continue;
      }
      seenGstin[gstin] = true;

      var nameKey = cleanClientName(parsed.client || parsed.firm || '');
      var warn = '';
      if (!gstGstinChecksumOk_(gstin)) warn = 'GSTIN ka check digit match nahi hua — ek baar verify karein.';
      if (!parsed.client) { parsed.client = nameKey || gstin; parsed.firm = parsed.firm || parsed.client; warn = warn || 'Naam file se nahi mila — app me edit kar lein.'; }
      if (nameKey && existing.names[nameKey] && !existing.gstins[gstin]) warn = 'Is naam ka client pehle se hai (GSTIN naya hai) — check karein.';

      candidates.push({
        fileId: f.getId(),
        fileName: fileName,
        gstin: gstin,
        client: parsed.client,
        firm: parsed.firm || parsed.client,
        address: parsed.address || '',
        state: GST_STATE_NAMES[gstin.substring(0, 2)] || '',
        rDate: parsed.rDate || '',
        source: source || 'filename',
        warn: warn
      });
    } catch (err) {
      errors.push({ fileName: fileName, error: String(err) });
    }
  }

  return {
    status: 'ok',
    folder: folder.getName(),
    folderId: folder.getId(),
    folderUrl: folderUrl,
    total: files.length,
    scanned: max,
    ocrAvailable: true, // OCR ab default chalta hai (OAuth REST fallback) — Drive service on karna optional
    driveServiceOn: gstCertOcrAvailable_(),
    ocrTried: ocrTried,
    ocrUsed: ocrUsed,
    candidates: candidates,
    skipped: skipped,
    errors: errors
  };
}

// Menu: saare clients ke FOLDER ID aur STATEMENT ID header ke hisab se bhar do (aur Active month me galti se aaye Folder ID saaf kare)
function fillAllClientIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var parent = DriveApp.getFolderById(CLIENTS_FOLDER_ID);
  var map = {}, dups = [];
  var it = parent.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var key = cleanClientName(f.getName());
    if (map[key]) dups.push(f.getName()); else map[key] = f;
  }
  var setF = 0, setS = 0, cleanedAM = 0, missing = [];
  ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;
    var cols = getTabCols(sheet);
    var rows = sheet.getRange(1, 1, sheet.getLastRow(), cols.maxCol).getValues();
    for (var i = 1; i < rows.length; i++) {
      var name = String(rows[i][cols.client - 1] || '').trim();
      if (!name || name === '0' || name === 'None') continue;
      var folderId = cols.folderId > 0 ? String(rows[i][cols.folderId - 1] || '').trim() : '';
      var stmtId = cols.statementId > 0 ? String(rows[i][cols.statementId - 1] || '').trim() : '';
      var fol = null;
      if (cols.folderId > 0 && !folderId) {
        fol = map[cleanClientName(name)];
        if (!fol) { missing.push(name); continue; }
        sheet.getRange(i + 1, cols.folderId).setValue(fol.getId());
        folderId = fol.getId(); setF++;
      }
      if (cols.statementId > 0 && !stmtId && folderId) {
        try {
          fol = fol || DriveApp.getFolderById(folderId);
          var files = fol.getFiles();
          while (files.hasNext()) {
            var file = files.next();
            if (file.getName().indexOf('Master Etsy Statement') > -1) {
              sheet.getRange(i + 1, cols.statementId).setValue(file.getId()); setS++; break;
            }
          }
        } catch (e) {}
      }
      if (cols.activeMonth > 0 && folderId) {
        var amVal = String(rows[i][cols.activeMonth - 1] || '').trim();
        if (amVal && amVal === folderId) {
          sheet.getRange(i + 1, cols.activeMonth).clearContent();
          cleanedAM++;
        }
      }
    }
  });
  SpreadsheetApp.flush();
  var msg = '✅ Folder ID: ' + setF + ' naye, Statement ID: ' + setS + ' naye.' +
    (cleanedAM ? ' 🧹 Active month se ' + cleanedAM + ' duplicate Folder IDs saaf kiye.' : '') +
    (missing.length ? ' ⚠️ Folder nahi mila: ' + missing.join(', ') + '.' : '') +
    (dups.length ? ' ⚠️ Same naam ke duplicate folder: ' + dups.join(', ') + '.' : '');
  ss.toast(msg, 'Fill IDs', 20);
  Logger.log(msg);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📁 GST Drive Tools')
    .addItem('⚡ 1-Click Sabhi 78 Clients ke Folders & Etsy Sheets Banayein', 'createAllClientFoldersAndEtsyStatements')
    .addItem('🆔 Fill all Folder/Statement IDs (Header-Based)', 'fillAllClientIds')
    .addItem('📊 Master Sheets D4 (GOV = I75 Total Order Value) Link Karein', 'repairAllMasterSheetsD4')
    .addItem('🔗 Fix All ROV IMPORTRANGE Links (Statement ID se)', 'fixAllRovImportRangeLinks')
    .addItem('🔧 Fix / Restore All Missing Formulas (DUE MON, ROV, Active)', 'restoreMissingSheetFormulas')
    .addItem('🆓 Apne Tab: PT Date -> FREE (Free Account)', 'markApneTabAsFreeAccounts')
    .addSeparator()
    .addItem('🗑️ Cleanup Unlinked Folders (Sirf 78 App Clients Rakhe)', 'cleanupUnwantedClientFolders')
    .addToUi();
}

// Menu: Purane/toote ROV IMPORTRANGE links ko STATEMENT ID ki live Master Etsy sheet se link karein (jaha ROV column maujood ho)
function fixAllRovImportRangeLinks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var updated = 0;
  ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;
    var cols = getTabCols(sheet);
    if (!cols.rov || !cols.statementId) return;
    var lastRow = Math.min(sheet.getLastRow(), 500);
    var names = sheet.getRange(1, cols.client, lastRow, 1).getValues();
    var rovFormulas = sheet.getRange(1, cols.rov, lastRow, 1).getFormulas();
    var stmtIds = sheet.getRange(1, cols.statementId, lastRow, 1).getValues();

    for (var i = 1; i < lastRow; i++) {
      var rowNum = i + 1;
      var clientName = String(names[i][0] || '').trim();
      var sid = String(stmtIds[i][0] || '').trim();
      if (!clientName || clientName === '0' || clientName === 'None' || !sid) continue;

      var curF = String(rovFormulas[i][0] || '');
      if (!curF || curF.indexOf(sid) === -1 || curF.indexOf('IFERROR(') === 1) {
        sheet.getRange(rowNum, cols.rov).setFormula('=IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + sid + '",TEXT(TODAY(),"mmmyy")&"!D5")');
        updated++;
      }
    }
  });
  SpreadsheetApp.flush();
  var msg = '✅ ' + updated + ' ROV IMPORTRANGE links live Statement IDs se update ho gaye! (Agar #REF! dikhe to cell par hover karke Allow access dabaein.)';
  ss.toast(msg, 'ROV Links Updated', 15);
  Logger.log(msg);
}


// Menu: Sabhi Master Etsy Sheets ke month tabs me D4 (Gross Order Value) ko =IF(I{totalRow}>0,I{totalRow},SUM(E4:P4)) set karein (ROV D5 =C4+D4-D8 jaisa tha waisa rahega)
function repairAllMasterSheetsD4() {
  var startMs = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var startIdx = Number(props.getProperty('REPAIR_D4_CURSOR') || '0') || 0;

  var seen = {};
  var targets = [];
  ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;
    var cols = getTabCols(sheet);
    if (!cols.statementId) return;
    var lastRow = Math.min(sheet.getLastRow(), 500);
    var names = sheet.getRange(1, cols.client, lastRow, 1).getValues();
    var stmtIds = sheet.getRange(1, cols.statementId, lastRow, 1).getValues();
    for (var i = 1; i < lastRow; i++) {
      var sid = String(stmtIds[i][0] || '').trim();
      var cname = String(names[i][0] || '').trim();
      if (!sid || !cname || cname === '0' || cname === 'None' || seen[sid]) continue;
      seen[sid] = true;
      targets.push({ name: cname, id: sid });
    }
  });

  if (startIdx >= targets.length) startIdx = 0;

  var monthTabs = ['Apr25','May25','Jun25','Jul25','Aug25','Sep25','Oct25','Nov25','Dec25','Jan26','Feb26','Mar26','Apr26','May26','Jun26','Jul26','Aug26','Sep26','Oct26','Nov26','Dec26','Jan27','Feb27','Mar27','Apr27','May27','Jun27','Jul27','Aug27','Sep27','Oct27','Nov27','Dec27','Jan28','Feb28','Mar28'];
  var filesDone = 0, tabsFixed = 0, skippedFiles = 0;

  for (var idx = startIdx; idx < targets.length; idx++) {
    if (Date.now() - startMs > 260000) {
      props.setProperty('REPAIR_D4_CURSOR', String(idx));
      SpreadsheetApp.flush();
      var pMsg = '⏳ Partial Complete: ' + filesDone + ' files (' + tabsFixed + ' tabs) update hue. Baaki (' + (targets.length - idx) + ' files) ke liye ye menu dobara chalayein.';
      ss.toast(pMsg, 'Master D4 Repair (Resume)', 20);
      Logger.log(pMsg);
      return;
    }
    try {
      var mss = SpreadsheetApp.openById(targets[idx].id);
      monthTabs.forEach(function(tName) {
        var tab = mss.getSheetByName(tName);
        if (!tab) return;
        var d45 = tab.getRange('D4:D5').getFormulas();
        var d4F = String(d45[0][0] || '').toUpperCase().replace(/\s+/g, '');
        var d5F = String(d45[1][0] || '').toUpperCase().replace(/\s+/g, '');
        if (d4F === '=IF(I75>0,I75,SUM(E4:P4))' && d5F && String(tab.getRange('A75').getDisplayValue()).indexOf('*****') === 0) {
          return;
        }
        var maxR = tab.getMaxRows();
        var colADisp = tab.getRange(ETSY_FIRST_ROW, 1, maxR - ETSY_FIRST_ROW + 1, 1).getDisplayValues();
        var totalRow = 75;
        for (var r = 0; r < colADisp.length; r++) {
          if (String(colADisp[r][0]).indexOf('*****') === 0) {
            totalRow = ETSY_FIRST_ROW + r;
            break;
          }
        }
        if (ensureGrossOrderLinkIfBlank(tab, totalRow)) {
          tabsFixed++;
        }
      });
      filesDone++;
    } catch (e) {
      skippedFiles++;
    }
  }

  props.deleteProperty('REPAIR_D4_CURSOR');
  SpreadsheetApp.flush();
  var msg = '✅ Master D4 (GOV) Repair Complete! Files: ' + filesDone + ' | Tabs Updated: ' + tabsFixed + (skippedFiles ? ' | Skipped: ' + skippedFiles : '');
  ss.toast(msg, 'Master D4 Updated', 15);
  Logger.log(msg);
}

function makeSheetDate(yr, mo, d, tz) {
  var y = Number(yr), m = Number(mo), day = Number(d);
  if (!y || !m || !day) return '';
  var zone = tz || (typeof Session !== 'undefined' && Session && Session.getScriptTimeZone ? Session.getScriptTimeZone() : '') || 'Asia/Kolkata';
  var iso = String(y) + '-' + (m < 10 ? '0' + m : String(m)) + '-' + (day < 10 ? '0' + day : String(day));
  if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.parseDate === 'function') {
    try {
      return Utilities.parseDate(iso + ' 00:00:00', zone, 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {}
  }
  return new Date(y, m - 1, day, 12, 0, 0);
}

function parsePtDateValue(val, tz) {
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  var s = String(val || '').trim();
  if (!s) return '';
  if (s.toUpperCase() === 'FREE') return 'FREE';
  var months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  var m1 = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,})[-\/\s](\d{4})$/);
  if (m1) {
    var mo = months[m1[2].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return makeSheetDate(Number(m1[3]), mo, Number(m1[1]), tz);
  }
  var m2 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m2) return makeSheetDate(Number(m2[1]), Number(m2[2]), Number(m2[3]), tz);
  var m3 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m3) return makeSheetDate(Number(m3[3]), Number(m3[2]), Number(m3[1]), tz);
  return s;
}

function buildSafeDueMonFormula(ptColL, rowNum) {
  return '=IF(OR(' + ptColL + rowNum + '="",NOT(ISNUMBER(' + ptColL + rowNum + '))),0,MAX(0,(YEAR(TODAY())-YEAR(' + ptColL + rowNum + '))*12+MONTH(TODAY())-MONTH(' + ptColL + rowNum + ')))';
}

function ensureDueMonFormula(sheet, rowNum, cols) {
  cols = cols || getTabCols(sheet);
  if (!cols.dueMon || !cols.ptDate) return;
  var dueCell = sheet.getRange(rowNum, cols.dueMon);
  var ptColL = colToLetter(cols.ptDate);
  var curF = String(dueCell.getFormula() || '');
  if (!curF || (curF.indexOf('YEAR(TODAY())') > -1 && curF.indexOf('NOT(ISNUMBER(') === -1)) {
    dueCell.setFormula(buildSafeDueMonFormula(ptColL, rowNum));
  }
}

function ensureStatusFormula(sheet, rowNum, statusStr, cols) {
  cols = cols || getTabCols(sheet);
  if (!cols.status) return;
  var stCell = sheet.getRange(rowNum, cols.status);
  var isInactive = String(statusStr || '').trim().toLowerCase().indexOf('inactive') > -1;
  if (isInactive) {
    stCell.setValue('Inactive CL');
    return;
  }
  var clColL = colToLetter(cols.client || 2);
  if (!stCell.getFormula()) {
    stCell.setFormula('=IF(' + clColL + rowNum + '<>"", "Active CL", "")');
  }
}

// Menu: Jin rows me DUE MON, ROV (agar column ho), ya Active CL ka formula hat gaya hai unhe wapas lagayein
function restoreMissingSheetFormulas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fixedDue = 0, fixedRov = 0, fixedStatus = 0;
  var ssTz = (ss && ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : '') || (typeof Session !== 'undefined' && Session.getScriptTimeZone ? Session.getScriptTimeZone() : '') || 'Asia/Kolkata';
  ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;
    var cols = getTabCols(sheet);
    var lastRow = Math.min(sheet.getLastRow(), 500);
    var names = sheet.getRange(1, cols.client, lastRow, 1).getValues();
    var ptVals = sheet.getRange(1, cols.ptDate, lastRow, 1).getValues();
    var dueFormulas = sheet.getRange(1, cols.dueMon, lastRow, 1).getFormulas();
    var rovFormulas = cols.rov > 0 ? sheet.getRange(1, cols.rov, lastRow, 1).getFormulas() : null;
    var statusVals = cols.status > 0 ? sheet.getRange(1, cols.status, lastRow, 1).getValues() : null;
    var statusFormulas = cols.status > 0 ? sheet.getRange(1, cols.status, lastRow, 1).getFormulas() : null;
    var stmtIds = cols.statementId > 0 ? sheet.getRange(1, cols.statementId, lastRow, 1).getValues() : null;
    var ptColL = colToLetter(cols.ptDate);
    var clColL = colToLetter(cols.client);

    for (var i = 1; i < lastRow; i++) {
      var rowNum = i + 1;
      var clientName = String(names[i][0] || '').trim();
      if (!clientName || clientName === '0' || clientName === 'None') continue;

      if (ptVals[i][0] && !(ptVals[i][0] instanceof Date)) {
        var parsed = parsePtDateValue(ptVals[i][0], ssTz);
        if (parsed instanceof Date) {
          var ptCell = sheet.getRange(rowNum, cols.ptDate);
          ptCell.setValue(parsed);
          ptCell.setNumberFormat('d"-"mmm"-"yyyy');
        }
      }

      var curDueF = String(dueFormulas[i][0] || '');
      if (!curDueF || (curDueF.indexOf('YEAR(TODAY())') > -1 && curDueF.indexOf('NOT(ISNUMBER(') === -1)) {
        sheet.getRange(rowNum, cols.dueMon).setFormula(buildSafeDueMonFormula(ptColL, rowNum));
        fixedDue++;
      }

      if (cols.rov > 0 && stmtIds && rovFormulas) {
        var sid = String(stmtIds[i][0] || '').trim();
        var curRovF = String(rovFormulas[i][0] || '');
        if (sid && (!curRovF || curRovF.indexOf(sid) === -1)) {
          sheet.getRange(rowNum, cols.rov).setFormula('=IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + sid + '",TEXT(TODAY(),"mmmyy")&"!D5")');
          fixedRov++;
        }
      }

      if (cols.status > 0 && statusVals && statusFormulas) {
        var stRaw = String(statusVals[i][0] || '').trim().toLowerCase();
        if (!statusFormulas[i][0] && stRaw.indexOf('inactive') === -1) {
          sheet.getRange(rowNum, cols.status).setFormula('=IF(' + clColL + rowNum + '<>"", "Active CL", "")');
          fixedStatus++;
        }
      }
    }
  });
  SpreadsheetApp.flush();
  var msg = '✅ Formulas Restored! DUE MON: ' + fixedDue + ' | ROV: ' + fixedRov + ' | Active Status: ' + fixedStatus;
  ss.toast(msg, 'Formulas Fixed', 12);
  Logger.log(msg);
}

// Apne tab ke sabhi client rows me PT DATE ko "FREE" aur DUE MON formula ko ISNUMBER-safe (=0) banana
function syncApneFreeAccountsInSheet(ss, apneRateOpt) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var apneRate = (apneRateOpt !== undefined && apneRateOpt !== null) ? Number(apneRateOpt) : 0;
  if (apneRate > 0) return { updatedPt: 0, fixedDue: 0, skipped: true };
  var sheet = ss.getSheetByName('Apne');
  if (!sheet || sheet.getLastRow() < 2) return { updatedPt: 0, fixedDue: 0 };
  var cols = getTabCols(sheet);
  if (!cols.client || !cols.ptDate) return { updatedPt: 0, fixedDue: 0 };
  var lastRow = Math.min(sheet.getLastRow(), 500);
  var names = sheet.getRange(1, cols.client, lastRow, 1).getValues();
  var ptDisp = sheet.getRange(1, cols.ptDate, lastRow, 1).getDisplayValues();
  var dueFormulas = cols.dueMon > 0 ? sheet.getRange(1, cols.dueMon, lastRow, 1).getFormulas() : null;
  var ptColL = colToLetter(cols.ptDate);
  var updatedPt = 0, fixedDue = 0;

  for (var i = 1; i < lastRow; i++) {
    var rowNum = i + 1;
    var clientName = String(names[i][0] || '').trim();
    if (cols.dueMon > 0 && dueFormulas) {
      var curF = String(dueFormulas[i][0] || '');
      if (!curF || (curF.indexOf('YEAR(TODAY())') > -1 && curF.indexOf('NOT(ISNUMBER(') === -1)) {
        sheet.getRange(rowNum, cols.dueMon).setFormula(buildSafeDueMonFormula(ptColL, rowNum));
        fixedDue++;
      }
    }
    if (!clientName || clientName === '0' || clientName === 'None') continue;
    var curPt = String(ptDisp[i][0] || '').trim().toUpperCase();
    if (curPt !== 'FREE') {
      var ptCell = sheet.getRange(rowNum, cols.ptDate);
      ptCell.setNumberFormat('@');
      ptCell.setValue('FREE');
      ptCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
      updatedPt++;
    }
  }
  if (updatedPt > 0 || fixedDue > 0) {
    SpreadsheetApp.flush();
  }
  return { updatedPt: updatedPt, fixedDue: fixedDue };
}

function markApneTabAsFreeAccounts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var res = syncApneFreeAccountsInSheet(ss, 0);
  var msg = '🆓 Apne Tab Free Account Updated! PT Date -> FREE: ' + res.updatedPt + ' rows | Safe DUE MON (=0): ' + res.fixedDue + ' rows';
  ss.toast(msg, 'Apne Free Accounts', 12);
  Logger.log(msg);
}

// 1. Ek Click me sabhi 78 clients ke folders aur andar Master Etsy Statement sheet banaye
function createAllClientFoldersAndEtsyStatements() {
  var parentFolder = DriveApp.getFolderById(CLIENTS_FOLDER_ID);
  var templateFile = DriveApp.getFileById(ETSY_MASTER_TEMPLATE_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var createdFolders = 0;
  var createdEtsySheets = 0;

  ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var cols = getTabCols(sheet);
    var rows = sheet.getDataRange().getDisplayValues();

    for (var i = 1; i < rows.length; i++) {
      var name = (rows[i][cols.client - 1] || '').toString().trim();
      if (!name || name === '0' || name === 'None') continue;
      var clean = name.replace(/\*/g, '').trim();

      var typeVal = cols.clientType > 0 ? (rows[i][cols.clientType - 1] || '').toString().toLowerCase() : '';
      var firm = cols.firm > 0 ? (rows[i][cols.firm - 1] || '').toString().toUpperCase() : '';
      var isEtsy = typeVal ? (typeVal.indexOf('reg') === -1 && (typeVal.indexOf('etsy') > -1 || tabName === 'PAID CLINTS')) : ((tabName === 'PAID CLINTS') || (firm.indexOf('RUGS') > -1) || (firm.indexOf('CARPET') > -1));

      // Folder check ya create
      var clientFolder = null;
      var it = parentFolder.getFoldersByName(clean);
      if (it.hasNext()) {
        clientFolder = it.next();
      } else {
        clientFolder = parentFolder.createFolder(clean);
        createdFolders++;
      }
      if (clientFolder && cols.folderId > 0 && !String(rows[i][cols.folderId - 1] || '').trim()) {
        sheet.getRange(i + 1, cols.folderId).setValue(clientFolder.getId());
      }

      // Etsy Master Statement check ya create
      if (isEtsy && clientFolder) {
        var sheetTitle = clean + ' Master Etsy Statement';
        var fIt = clientFolder.getFilesByName(sheetTitle);
        var stmtFile = null;
        if (fIt.hasNext()) {
          stmtFile = fIt.next();
        } else {
          stmtFile = templateFile.makeCopy(sheetTitle, clientFolder);
          createdEtsySheets++;
        }
        if (stmtFile && cols.statementId > 0 && !String(rows[i][cols.statementId - 1] || '').trim()) {
          sheet.getRange(i + 1, cols.statementId).setValue(stmtFile.getId());
        }
      }
    }
  });

  var msg = '✅ Kaam Pura: ' + createdFolders + ' naye folders aur ' + createdEtsySheets + ' Master Etsy Statements banaye gaye!';
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Done', 10);
  Logger.log(msg);
}

// 2. Unlinked Folders Cleaner
function cleanupUnwantedClientFolders() {
  var parentFolder = DriveApp.getFolderById(CLIENTS_FOLDER_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var validSet = {};
  ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var cols = getTabCols(sheet);
    var rows = sheet.getDataRange().getDisplayValues();
    for (var i = 1; i < rows.length; i++) {
      var name = (rows[i][cols.client - 1] || '').toString().trim();
      if (name && name !== '0' && name !== 'None') {
        validSet[name.replace(/\*/g, '').toUpperCase().trim()] = true;
      }
    }
  });

  var subfolders = parentFolder.getFolders();
  var keptCount = 0;
  var deletedCount = 0;

  while (subfolders.hasNext()) {
    var f = subfolders.next();
    var folderName = f.getName().replace(/\*/g, '').toUpperCase().trim();

    if (validSet[folderName]) {
      keptCount++;
    } else {
      f.setTrashed(true);
      deletedCount++;
    }
  }

  var msg = '✅ ' + keptCount + ' zaroori folders rakhe gaye, ' + deletedCount + ' bekar folders Trash me daal diye gaye!';
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Drive Cleanup', 8);
}

// ===========================================================
// ETSY STATEMENT -> CLIENT MASTER ETSY STATEMENT (month ke hisab se)
// Orders: Row 45 se (A:H only — formulas/invoice columns ko haath nahi lagta)
// Fees  : "ETSY FEES" table (Charged / Credits) — label dhoondh kar
// Duplicate order dobara add nahi hota.
// ===========================================================
var ETSY_FIRST_ROW = 45;

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===== GSTR-1 JSON: Drive folder "json" me save / list / read (app ke Save + Select ke liye) =====
var GSTR1_JSON_FOLDER_NAME = 'json';

function getGstr1JsonFolder() {
  var it = DriveApp.getFoldersByName(GSTR1_JSON_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(GSTR1_JSON_FOLDER_NAME);
}

function gstr1JsonSafeName(name) {
  var out = String(name || 'GSTR1.json').replace(/[^A-Za-z0-9._-]/g, '_');
  if (out.indexOf('.json') === -1) out = out + '.json';
  return out;
}

function saveGstr1Json(data) {
  var text = String((data && data.jsonText) || '');
  if (!text) return { status: 'error', message: 'JSON text khaali hai' };
  var folder = getGstr1JsonFolder();
  var fname = gstr1JsonSafeName(data.fileName);
  var same = folder.getFilesByName(fname);
  while (same.hasNext()) same.next().setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(text, 'application/json', fname));
  return { status: 'ok', id: file.getId(), name: file.getName(), url: file.getUrl(), folder: folder.getName(), size: text.length };
}

function listGstr1Json() {
  var folder = getGstr1JsonFolder();
  var files = folder.getFiles();
  var out = [];
  while (files.hasNext()) {
    var f = files.next();
    if (f.isTrashed()) continue;
    out.push({ id: f.getId(), name: f.getName(), size: f.getSize(), updated: Utilities.formatDate(f.getLastUpdated(), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm') });
    if (out.length === 300) break;
  }
  out.sort(function (a, b) { return String(b.name).localeCompare(String(a.name)); });
  return { status: 'ok', folder: folder.getName(), files: out };
}

function readGstr1Json(data) {
  var id = String((data && data.id) || '');
  if (!id) return { status: 'error', message: 'File id missing' };
  var f = DriveApp.getFileById(id);
  return { status: 'ok', id: f.getId(), name: f.getName(), text: f.getBlob().getDataAsString() };
}

function findClientMasterEtsyFile(clientName, category) {
  var loc = findClientRow(clientName, category);
  if (loc && loc.cols.statementId > 0) {
    var sid = String(loc.sheet.getRange(loc.row, loc.cols.statementId).getValue() || '').trim();
    if (sid) { try { var sf = DriveApp.getFileById(sid); if (!sf.isTrashed()) return sf; } catch (e) {} }
  }
  var folder = getClientFolder(clientName, category, false);
  if (!folder) return null;
  var found = null;
  var sIt = folder.getFilesByName(clientName + ' Master Etsy Statement');
  if (sIt.hasNext()) found = sIt.next();
  else {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      if (file.getName().indexOf('Master Etsy Statement') > -1) { found = file; break; }
    }
  }
  if (found && loc && loc.cols.statementId > 0) loc.sheet.getRange(loc.row, loc.cols.statementId).setValue(found.getId());
  return found;
}

// ===========================================================
// FILES DROPDOWN SUPPORT: Master Etsy (current month tab) + Document Upload
// ===========================================================
function findClientFolder(clientName) {
  var parent = DriveApp.getFolderById(CLIENTS_FOLDER_ID);
  var fIt = parent.getFoldersByName(clientName);
  if (fIt.hasNext()) return fIt.next();
  var want = clientName.toUpperCase();
  var all = parent.getFolders();
  while (all.hasNext()) {
    var f = all.next();
    if (f.getName().trim().toUpperCase() === want) return f;
  }
  return null;
}

// Client ki Master Etsy file ka URL (agar tab mile to seedha usi tab ka link)
function getEtsyMasterUrl(data) {
  try {
    var clientClean = String(data.client || '').replace(/\*/g, '').trim();
    if (!clientClean) return { status: 'error', message: 'Client ka naam missing hai.' };
    var file = findClientMasterEtsyFile(clientClean, data.category);
    if (!file) return { status: 'error', message: clientClean + ' ki Master Etsy Statement Drive me nahi mili.' };
    var url = file.getUrl();
    var tabFound = false;
    try {
      var ss = SpreadsheetApp.open(file);
      var tab = ss.getSheetByName(String(data.tab || ''));
      if (tab) { url = ss.getUrl() + '#gid=' + tab.getSheetId(); tabFound = true; }
    } catch (e) {}
    return { status: 'ok', url: url, tab: data.tab || '', tabFound: tabFound };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}

// Client ke folder ke andar 'Documents' naam ke alag folder me file save kare
function uploadClientDocument(data) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { status: 'error', message: 'Script busy hai, thodi der baad dobara try karein.' };
  }
  try {
    var clientClean = String(data.client || '').replace(/\*/g, '').trim();
    if (!clientClean || !data.data) return { status: 'error', message: 'Client ya file data missing hai.' };

    var folder = getClientFolder(clientClean, data.category, true);

    var dIt = folder.getFoldersByName('Documents');
    var docs = dIt.hasNext() ? dIt.next() : folder.createFolder('Documents');

    var name = String(data.fileName || 'document').replace(/[\\\/]/g, '_');
    if (docs.getFilesByName(name).hasNext()) {
      var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
      var dot = name.lastIndexOf('.');
      name = (dot > 0) ? name.substring(0, dot) + ' (' + stamp + ')' + name.substring(dot) : name + ' (' + stamp + ')';
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(data.data), data.mimeType || 'application/octet-stream', name);
    var f = docs.createFile(blob);
    return { status: 'ok', uploaded: true, fileName: f.getName(), fileUrl: f.getUrl(), folderUrl: docs.getUrl() };
  } catch (err) {
    return { status: 'error', message: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e3) {}
  }
}

function processEtsyStatement(data) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { status: 'error', message: 'Script busy hai, thodi der baad dobara try karein.' };
  }
  try {
    var clientClean = String(data.client || '').replace(/\*/g, '').trim();
    if (!clientClean || !data.months || !data.months.length) {
      return { status: 'error', message: 'Client ya statement data missing hai.' };
    }
    var file = findClientMasterEtsyFile(clientClean, data.category);
    if (!file) return { status: 'error', message: clientClean + ' ki Master Etsy Statement Drive me nahi mili.' };

    var clientSS = SpreadsheetApp.open(file);
    var results = [];
    data.months.forEach(function(m) {
      var tab = clientSS.getSheetByName(m.tab);
      if (!tab) { results.push({ tab: m.tab, error: 'Is naam ka tab sheet me nahi hai' }); return; }
      try { results.push(writeEtsyMonth(tab, m)); }
      catch (err) { results.push({ tab: m.tab, error: String(err) }); }
    });
    SpreadsheetApp.flush();

    try {
      if (data.rov !== undefined) {
        var mainSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.category || 'PAID CLINTS');
        if (mainSheet) {
          var mainCols = getTabCols(mainSheet); ensureRovColumn(mainSheet, mainCols);
          if (mainCols.rov > 0) {
            var lastR = Math.min(Math.max(mainSheet.getLastRow(), 2), 500);
            var names = mainSheet.getRange(1, mainCols.client, lastR, 1).getValues();
            for (var i = 1; i < names.length; i++) {
              if (cleanClientName(names[i][0]) === clientClean.toUpperCase()) {
                var rovCell = mainSheet.getRange(i + 1, mainCols.rov);
                var newRovVal = Number(data.rov) || 0;
                if (!rovCell.getFormula() || Math.abs((Number(rovCell.getValue()) || 0) - newRovVal) > 0.005) {
                  rovCell.setValue(newRovVal);
                }
                break;
              }
            }
          }
        }
      }
    } catch (e2) {}

    return { status: 'ok', client: clientClean, results: results };
  } catch (err) {
    return { status: 'error', message: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e3) {}
  }
}

function writeEtsyMonth(tab, m) {
  var lastCol = Math.max(tab.getLastColumn(), 14);
  var maxRows = tab.getMaxRows();
  var colA = tab.getRange(ETSY_FIRST_ROW, 1, maxRows - ETSY_FIRST_ROW + 1, 1).getDisplayValues();
  var totalRow = 0;
  for (var i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).indexOf('*****') === 0) { totalRow = ETSY_FIRST_ROW + i; break; }
  }
  if (!totalRow || totalRow <= ETSY_FIRST_ROW) {
    return { tab: m.tab, error: 'Orders ki total row ("*****") nahi mili' };
  }

  var n = totalRow - ETSY_FIRST_ROW;
  var existing = tab.getRange(ETSY_FIRST_ROW, 1, n, 4).getValues();
  var seen = {};
  var free = [];
  for (var j = 0; j < n; j++) {
    var r = existing[j];
    var ord = String(r[1]).trim();
    if (ord) seen[ord + '|' + (Number(r[2]) || 0) + '|' + (Number(r[3]) || 0)] = true;
    else if (r[0] === '' && r[2] === '') free.push(ETSY_FIRST_ROW + j);
  }

  var toAdd = [];
  var skipped = 0;
  (m.orders || []).forEach(function(o) {
    var key = String(o.orderNo) + '|' + (Number(o.gross) || 0) + '|' + (Number(o.refund) || 0);
    if (seen[key]) { skipped++; return; }
    seen[key] = true;
    toAdd.push(o);
  });

  // Jagah kam ho to LAST data row ke upar rows insert (taaki Total ki range khud badh jaye)
  var inserted = 0;
  if (toAdd.length > free.length) {
    var extra = toAdd.length - free.length;
    var lastDataRow = totalRow - 1;
    tab.insertRowsBefore(lastDataRow, extra);
    var srcRow = lastDataRow + extra;
    var src = tab.getRange(srcRow, 1, 1, lastCol);
    var dst = tab.getRange(lastDataRow, 1, extra, lastCol);
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    var fr = src.getFormulasR1C1()[0];
    for (var c = 8; c < lastCol; c++) {
      if (fr[c] && String(fr[c]).charAt(0) === '=') {
        tab.getRange(lastDataRow, c + 1, extra, 1).setFormulaR1C1(fr[c]);
      }
    }
    // insert ke baad purani free rows (last data row wali) neeche khisak jaati hain
    free = free.map(function(rw) { return rw >= lastDataRow ? rw + extra : rw; });
    for (var k = 0; k < extra; k++) free.push(lastDataRow + k);
    inserted = extra;
    totalRow += extra;
  }
  free.sort(function(a, b) { return a - b; });

  var tabTz = (tab && tab.getParent ? tab.getParent().getSpreadsheetTimeZone() : '') || (typeof Session !== 'undefined' && Session.getScriptTimeZone ? Session.getScriptTimeZone() : '') || 'Asia/Kolkata';
  toAdd.forEach(function(o, idx) {
    var row = free[idx];
    var p = String(o.iso || '').split('-');
    var d = (p.length === 3) ? makeSheetDate(p[0], p[1], p[2], tabTz) : '';
    tab.getRange(row, 1, 1, 8).setValues([[
      d, Number(o.orderNo) || o.orderNo, Number(o.gross) || 0, Number(o.refund) || 0,
      Number(o.buyerTax) || 0, Number(o.taxRefund) || 0, Number(o.tcs) || 0, Number(o.tds) || 0
    ]]);
    if (d instanceof Date) tab.getRange(row, 1).setNumberFormat('dd/mm/yyyy');
  });
  ensureGrossOrderLinkIfBlank(tab, totalRow);

  // Fees table — label se rows dhoondhte hain (rows insert hone par bhi sahi rahe)
  var feesUpdated = false;
  var after = tab.getRange(totalRow, 1, tab.getMaxRows() - totalRow + 1, 1).getValues();
  if (m.fees) {
    var rules = [
      ['ads', 'etsy ads'], ['transaction', 'transaction fee'], ['processing', 'processing fee'],
      ['regulatory', 'regulatory'], ['listing', 'listing fee'], ['other', 'other fee']
    ];
    rules.forEach(function(rule) {
      var f = m.fees[rule[0]];
      if (!f) return;
      for (var q = 0; q < after.length; q++) {
        if (String(after[q][0]).toLowerCase().trim().indexOf(rule[1]) === 0) {
          tab.getRange(totalRow + q, 2, 1, 2).setValues([[Number(f.charged) || 0, Number(f.credits) || 0]]);
          feesUpdated = true;
          break;
        }
      }
    });
  }

  // GST SUMMARY ka "Month" input (sirf tab bharte hain jab khali ho)
  if (m.label) {
    for (var z = 0; z < after.length; z++) {
      if (String(after[z][0]).toLowerCase().trim() === 'month') {
        var mc = tab.getRange(totalRow + z, 2);
        if (String(mc.getValue()).trim() === '') mc.setValue(m.label);
        break;
      }
    }
  }

  return { tab: m.tab, added: toAdd.length, skipped: skipped, insertedRows: inserted, feesUpdated: feesUpdated };
}


// 3B. Fee Ledger & Client 6M Profiles 2-Way Sheet Sync (_FeeLedger & _FeeProfiles tabs)
function getOrCreateFeeSheet(ss, tabName, headers) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readFeeData(ss) {
  var out = { supported: true, ledger: [], profiles: {}, customFees: {}, rates: null };
  try {
    var lSh = ss.getSheetByName('_FeeLedger');
    if (lSh && lSh.getLastRow() >= 2) {
      var lColCount = Math.max(lSh.getLastColumn(), 14);
      var lDisp = lSh.getRange(2, 1, lSh.getLastRow() - 1, lColCount).getDisplayValues();
      var lVals = lSh.getRange(2, 1, lSh.getLastRow() - 1, lColCount).getValues();
      for (var i = 0; i < lDisp.length; i++) {
        var rNo = String(lDisp[i][0] || '').trim();
        var cName = String(lDisp[i][2] || '').trim();
        if (!rNo && !cName) continue;
        out.ledger.push({
          receiptNo: rNo,
          clientKey: String(lDisp[i][1] || '').trim(),
          client: cName,
          firm: String(lDisp[i][3] || '').trim(),
          date: String(lDisp[i][4] || '').trim(),
          months: Number(lVals[i][5]) || 0,
          amount: Number(lVals[i][6]) || 0,
          mode: String(lDisp[i][7] || '').trim(),
          newPtDate: String(lDisp[i][8] || '').trim(),
          remarks: String(lDisp[i][9] || '').trim(),
          gstin: String(lDisp[i][10] || '').trim(),
          activeMonthsPaid: Math.max(0, Number(lVals[i][12]) || 0),
          saleMonthTag: String(lDisp[i][13] || '').trim()
        });
      }
    }

    var pSh = ss.getSheetByName('_FeeProfiles');
    if (pSh && pSh.getLastRow() >= 2) {
      var pColCount = Math.max(pSh.getLastColumn(), 11);
      var pRows = pSh.getRange(2, 1, pSh.getLastRow() - 1, pColCount).getValues();
      for (var j = 0; j < pRows.length; j++) {
        var cKey = String(pRows[j][0] || '').trim();
        if (cKey) {
          var profObj = {
            sixMonthPaid: pRows[j][2] === true || String(pRows[j][2]).toUpperCase() === 'TRUE',
            nilDueMon: Math.max(0, Number(pRows[j][3]) || 0),
            activeDueMon: Math.max(0, Number(pRows[j][4]) || 0),
            activePaidMon: Math.max(0, Number(pRows[j][9]) || 0)
          };
          var actJsonStr = String(pRows[j][10] || '').trim();
          if (actJsonStr) {
            try {
              var parsedAct = JSON.parse(actJsonStr);
              if (parsedAct && parsedAct.payments && typeof parsedAct.payments === 'object') {
                profObj.activeMonthPayments = parsedAct.payments;
              }
              if (parsedAct && Array.isArray(parsedAct.manualMonths)) {
                profObj.manualActiveMonths = parsedAct.manualMonths;
              }
            } catch (ae) {}
          }
          out.profiles[cKey] = profObj;
          if (pRows[j][5] !== '' && pRows[j][5] !== null && pRows[j][5] !== undefined && !isNaN(Number(pRows[j][5]))) {
            out.customFees[cKey] = Number(pRows[j][5]);
          }
        }
        var cfgKey = String(pRows[j][7] || '').trim();
        var cfgJson = String(pRows[j][8] || '').trim();
        if (cfgKey === 'DEFAULT_RATES' && cfgJson) {
          try { out.rates = JSON.parse(cfgJson); } catch (je) {}
        }
      }
    }
  } catch (err) {}
  return out;
}

function saveFeeData(ss, data) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (le) { return { status: 'error', message: 'Script busy, dobara try karein' }; }
  try {
    var nowIso = new Date().toISOString();
    var lHeaders = ['ReceiptNo', 'ClientKey', 'ClientName', 'Firm', 'PayDate', 'Months', 'Amount', 'Mode', 'NewPtDate', 'Remarks', 'GSTIN', 'UpdatedAt', 'ActivePaidMonths', 'SaleMonthTag'];
    var lSh = getOrCreateFeeSheet(ss, '_FeeLedger', lHeaders);
    lSh.getRange(1, 1, 1, lHeaders.length).setValues([lHeaders]).setFontWeight('bold');
    if (lSh.getLastRow() >= 2) {
      lSh.getRange(2, 1, lSh.getLastRow() - 1, Math.max(lSh.getLastColumn(), 14)).clearContent();
    }
    var ledger = Array.isArray(data.ledger) ? data.ledger : [];
    if (ledger.length > 0) {
      var lRows = ledger.map(function(item) {
        return [
          String(item.receiptNo || ''),
          String(item.clientKey || ''),
          String(item.client || ''),
          String(item.firm || ''),
          String(item.date || ''),
          Number(item.months) || 0,
          Number(item.amount) || 0,
          String(item.mode || ''),
          String(item.newPtDate || ''),
          String(item.remarks || ''),
          String(item.gstin || ''),
          nowIso,
          Math.max(0, Number(item.activeMonthsPaid) || 0),
          String(item.saleMonthTag || '')
        ];
      });
      var lRng = lSh.getRange(2, 1, lRows.length, 14);
      lSh.getRange(2, 1, lRows.length, 5).setNumberFormat('@');
      lSh.getRange(2, 8, lRows.length, 5).setNumberFormat('@');
      lSh.getRange(2, 14, lRows.length, 1).setNumberFormat('@');
      lRng.setValues(lRows);
    }

    var pHeaders = ['ClientKey', 'ClientName', 'SixMonthPaid', 'NilDueMon', 'ActiveDueMon', 'CustomFee', 'UpdatedAt', 'ConfigKey', 'ConfigJson', 'ActivePaidMon', 'ActiveMonthDataJson'];
    var pSh = getOrCreateFeeSheet(ss, '_FeeProfiles', pHeaders);
    pSh.getRange(1, 1, 1, pHeaders.length).setValues([pHeaders]).setFontWeight('bold');
    if (pSh.getLastRow() >= 2) {
      pSh.getRange(2, 1, pSh.getLastRow() - 1, Math.max(pSh.getLastColumn(), 11)).clearContent();
    }
    var profiles = (data.profiles && typeof data.profiles === 'object') ? data.profiles : {};
    var customFees = (data.customFees && typeof data.customFees === 'object') ? data.customFees : {};
    var clientNamesMap = (data.clientNames && typeof data.clientNames === 'object') ? data.clientNames : {};
    var keysMap = {};
    Object.keys(profiles).forEach(function(k) { keysMap[k] = true; });
    Object.keys(customFees).forEach(function(k) { keysMap[k] = true; });
    var allKeys = Object.keys(keysMap);
    var pRows = [];
    for (var i = 0; i < allKeys.length; i++) {
      var k = allKeys[i];
      var pr = profiles[k] || {};
      var cf = (customFees[k] !== undefined && customFees[k] !== null && customFees[k] !== '') ? Number(customFees[k]) : '';
      var hasActPay = pr.activeMonthPayments && typeof pr.activeMonthPayments === 'object' && Object.keys(pr.activeMonthPayments).length > 0;
      var hasManMon = Array.isArray(pr.manualActiveMonths) && pr.manualActiveMonths.length > 0;
      var actJson = (hasActPay || hasManMon) ? JSON.stringify({
        payments: hasActPay ? pr.activeMonthPayments : {},
        manualMonths: hasManMon ? pr.manualActiveMonths : []
      }) : '';
      pRows.push([
        String(k),
        String(clientNamesMap[k] || ''),
        Boolean(pr.sixMonthPaid),
        Math.max(0, Number(pr.nilDueMon) || 0),
        Math.max(0, Number(pr.activeDueMon) || 0),
        cf,
        nowIso,
        i === 0 && data.rates ? 'DEFAULT_RATES' : '',
        i === 0 && data.rates ? JSON.stringify(data.rates) : '',
        Math.max(0, Number(pr.activePaidMon) || 0),
        actJson
      ]);
    }
    if (pRows.length === 0 && data.rates) {
      pRows.push(['', '', '', '', '', '', nowIso, 'DEFAULT_RATES', JSON.stringify(data.rates), 0, '']);
    }
    if (pRows.length > 0) {
      pSh.getRange(2, 1, pRows.length, 2).setNumberFormat('@');
      pSh.getRange(2, 7, pRows.length, 3).setNumberFormat('@');
      pSh.getRange(2, 11, pRows.length, 1).setNumberFormat('@');
      pSh.getRange(2, 1, pRows.length, 11).setValues(pRows);
    }
    if (data.rates && Number(data.rates.apne || 0) === 0) {
      syncApneFreeAccountsInSheet(ss, 0);
    }
    SpreadsheetApp.flush();
    return { status: 'ok', feeSaved: true, ledgerCount: ledger.length, profileCount: allKeys.length };
  } catch (err) {
    return { status: 'error', message: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ROV Sync: sabhi Etsy clients ka LIVE ROV seedha Master Etsy sheet ke current month D5 se (IMPORTRANGE ki der ke bina)
function getAllRov(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var started = new Date().getTime();
    var out = [];
    var skipped = [];
    var partial = false;
    ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) return;
      var cols = getTabCols(sheet);
      if (!cols.client) return;
      var rows = sheet.getDataRange().getDisplayValues();
      var seen = {};
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        var name = (r[cols.client - 1] || '').toString().trim();
        if (!name || name === '0' || name === 'None') continue;
        var cleanUpper = name.toUpperCase().replace(/\*/g, '').trim();
        if (seen[cleanUpper]) continue;
        seen[cleanUpper] = true;
        var typeVal = cols.clientType > 0 ? (r[cols.clientType - 1] || '').toString().trim() : '';
        if (typeVal.toLowerCase().indexOf('reg') > -1) continue;
        if (new Date().getTime() - started > 240000) { partial = true; skipped.push(cleanUpper); continue; }
        try {
          var stmtId = cols.statementId > 0 ? (r[cols.statementId - 1] || '').toString().trim() : '';
          var mss = null;
          if (stmtId) { try { mss = SpreadsheetApp.openById(stmtId); } catch (oe) { mss = null; } }
          if (!mss) { var mf = findClientMasterEtsyFile(cleanUpper, tabName); if (mf) mss = SpreadsheetApp.open(mf); }
          if (!mss) { skipped.push(cleanUpper); continue; }
          var tz = mss.getSpreadsheetTimeZone() || 'Asia/Kolkata';
          var now = new Date();
          var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var curM = parseInt(Utilities.formatDate(now, tz, 'M'), 10) - 1;
          var curY = parseInt(Utilities.formatDate(now, tz, 'yyyy'), 10);
          var val = null, usedTab = '';
          for (var back = 0; back < 12 && val === null; back++) {
            var mi = curM - back, yy = curY;
            while (mi < 0) { mi += 12; yy -= 1; }
            var tn = MON[mi] + String(yy % 100 < 10 ? '0' + (yy % 100) : yy % 100);
            var sh = mss.getSheetByName(tn);
            if (sh) {
              var v = sh.getRange('D5').getValue();
              if (typeof v === 'number' && !isNaN(v)) { val = Math.round(v * 100) / 100; usedTab = tn; }
            }
          }
          if (val === null) { skipped.push(cleanUpper); continue; }
          out.push({ category: tabName, client: cleanUpper, rov: val, tab: usedTab });
        } catch (ce) { skipped.push(cleanUpper); }
      }
    });
    return { status: 'ok', rov: out, skipped: skipped, partial: partial };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}

// 3. doGet: Sheet -> App Sync
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (e && e.parameter && e.parameter.payload) {
    try {
      var data = JSON.parse(decodeURIComponent(e.parameter.payload));
      if (data && data.action === 'etsyStatement') { return jsonOut(processEtsyStatement(data)); }
      if (data && data.action === 'getEtsyMasterUrl') { return jsonOut(getEtsyMasterUrl(data)); }
      if (data && data.action === 'getAllRov') { return jsonOut(getAllRov(data)); }
      if (data && data.action === 'saveFeeData') { return jsonOut(saveFeeData(ss, data)); }
      return jsonOut(handleSyncAction(ss, data));
    } catch(err) {
      return jsonOut({ status: 'error', message: String(err) });
    }
  }

  var feeData = readFeeData(ss);
  var apneRate = (feeData && feeData.rates && feeData.rates.apne !== undefined) ? Number(feeData.rates.apne) : 0;
  if (apneRate === 0) {
    try { syncApneFreeAccountsInSheet(ss, 0); } catch (ae) {}
  }

  var parentFolder = null;
  try { parentFolder = DriveApp.getFolderById(CLIENTS_FOLDER_ID); } catch(err) {}

  var result = [];
  var uid = 1;

  ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var cols = getTabCols(sheet);
    var rows = sheet.getDataRange().getDisplayValues();
    var rawValues = sheet.getDataRange().getValues();

    var seenClients = {};
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var name = (r[cols.client - 1] || '').toString().trim();
      if (!name || name === '0' || name === 'None') continue;
      var cleanUpper = name.toUpperCase().replace(/\*/g, '').trim();
      if (seenClients[cleanUpper]) continue;
      seenClients[cleanUpper] = true;

      var typeVal = cols.clientType > 0 ? (r[cols.clientType - 1] || '').toString().trim() : '';
      var clientType = (typeVal.toLowerCase().indexOf('reg') > -1) ? 'Regular Client' : 'Etsy Client';
      var isEtsy = (clientType === 'Etsy Client');

      var folderId = cols.folderId > 0 ? (r[cols.folderId - 1] || '').toString().trim() : '';
      var statementId = cols.statementId > 0 ? (r[cols.statementId - 1] || '').toString().trim() : '';
      var folderUrl = folderId ? 'https://drive.google.com/drive/folders/' + folderId : '';
      if (!folderId && parentFolder) {
        try {
          var it = parentFolder.getFoldersByName(cleanUpper);
          var fol;
          if (it.hasNext()) { fol = it.next(); }
          else {
            fol = parentFolder.createFolder(cleanUpper);
            if (isEtsy) {
              statementId = DriveApp.getFileById(ETSY_MASTER_TEMPLATE_ID).makeCopy(cleanUpper + ' Master Etsy Statement', fol).getId();
            }
          }
          folderId = fol.getId();
          folderUrl = fol.getUrl();
          if (cols.folderId > 0) sheet.getRange(i + 1, cols.folderId).setValue(folderId);
          if (statementId && cols.statementId > 0) sheet.getRange(i + 1, cols.statementId).setValue(statementId);
        } catch(fe) {}
      }

      var rawActiveM = cols.activeMonth > 0 ? (r[cols.activeMonth - 1] || '').toString().trim() : '';
      if (rawActiveM && (rawActiveM === folderId || /^[A-Za-z0-9_-]{24,}$/.test(rawActiveM))) {
        rawActiveM = '';
      }
      var statusRaw = cols.status > 0 ? (r[cols.status - 1] || '').toString().trim().toLowerCase() : '';

      result.push({
        sr: uid++,
        sheetRow: i + 1,
        sheetSr: Number(r[cols.sr - 1]) || i,
        category: tabName,
        clientType: clientType,
        client: name,
        id: (r[cols.id - 1] || '').toString().trim(),
        gstin: (r[cols.gstin - 1] || '').toString().trim(),
        firm: (r[cols.firm - 1] || '').toString().trim(),
        mobile: (r[cols.mobile - 1] || '').toString().trim(),
        rDate: (r[cols.rDate - 1] || '').toString().trim(),
        filed: rawValues[i][cols.filed - 1] === true || String(r[cols.filed - 1]).toUpperCase() === 'TRUE',
        ptDate: (r[cols.ptDate - 1] || '').toString().trim(),
        dueMon: Number(r[cols.dueMon - 1]) || 0,
        noticeStatus: (r[cols.noticeStatus - 1] || '').toString().trim(),
        noticeDate: (r[cols.noticeDate - 1] || '').toString().trim(),
        rov: cols.rov > 0 ? (Number(String(r[cols.rov - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0,
        hasRovCol: Boolean(cols.rov > 0),
        activeM: rawActiveM,
        reference: cols.reference > 0 ? (r[cols.reference - 1] || '').toString().trim() : '',
        address: cols.address > 0 ? (r[cols.address - 1] || '').toString().trim() : '',
        status: (statusRaw.indexOf('inactive') > -1) ? 'Inactive' : 'Active',
        uid: cols.uid > 0 ? (r[cols.uid - 1] || '').toString().trim() : '',
        folderId: folderId,
        statementId: statementId,
        driveUrl: folderUrl,
        password: cols.password > 0 ? (r[cols.password - 1] || '').toString().trim() : '',
        portalData: (function() {
          var pPer = cols.portalPeriod > 0 ? (r[cols.portalPeriod - 1] || '').toString().trim() : '';
          var pUpd = cols.portalUpdatedAt > 0 ? (r[cols.portalUpdatedAt - 1] || '').toString().trim() : '';
          var pIgst = cols.gstr2bIgst > 0 ? (Number(String(r[cols.gstr2bIgst - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pCgst = cols.gstr2bCgst > 0 ? (Number(String(r[cols.gstr2bCgst - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pSgst = cols.gstr2bSgst > 0 ? (Number(String(r[cols.gstr2bSgst - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pCess = cols.gstr2bCess > 0 ? (Number(String(r[cols.gstr2bCess - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pInel = cols.gstr2bIneligible > 0 ? (Number(String(r[cols.gstr2bIneligible - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pSupp = cols.gstr2bSuppliers > 0 ? (Number(String(r[cols.gstr2bSuppliers - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pEGrs = cols.ecomGross > 0 ? (Number(String(r[cols.ecomGross - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pENet = cols.ecomNet > 0 ? (Number(String(r[cols.ecomNet - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pETcs = cols.ecomTcs > 0 ? (Number(String(r[cols.ecomTcs - 1] || '0').replace(/[^0-9.\-]/g, '')) || 0) : 0;
          var pEPlt = cols.ecomPlatforms > 0 ? (r[cols.ecomPlatforms - 1] || '').toString().trim() : '';
          var pNotC = cols.portalNoticesCount > 0 ? (Number(r[cols.portalNoticesCount - 1]) || 0) : 0;
          var pNotS = cols.portalNotices > 0 ? (r[cols.portalNotices - 1] || '').toString().trim() : '';
          var pDrv  = cols.gstr2bDriveLink > 0 ? (r[cols.gstr2bDriveLink - 1] || '').toString().trim() : '';
          var pB2bJ = cols.b2bSellersJson > 0 ? (r[cols.b2bSellersJson - 1] || '').toString().trim() : '';
          var pEcoJ = cols.ecoListJson > 0 ? (r[cols.ecoListJson - 1] || '').toString().trim() : '';
          var b2bArr = []; try { if (pB2bJ) b2bArr = JSON.parse(pB2bJ); } catch (_) {}
          var ecoArr = []; try { if (pEcoJ) ecoArr = JSON.parse(pEcoJ); } catch (_) {}
          var pDocC = cols.docCollected > 0 ? (rawValues[i][cols.docCollected - 1] === true || String(r[cols.docCollected - 1] || '').toUpperCase() === 'TRUE') : false;
          var p2bSt = cols.gstr2bStatus > 0 ? (r[cols.gstr2bStatus - 1] || '').toString().trim().toUpperCase() : '';
          if (!pPer && !pUpd && !pIgst && !pCgst && !pSgst && !pEGrs && !pNotC && !pDrv) return null;
          return {
            period: pPer, noticesCount: pNotC, noticesSummary: pNotS,
            igst: pIgst, cgst: pCgst, sgst: pSgst, cess: pCess, ineligible: pInel, suppliers: pSupp,
            ecomGross: pEGrs, ecomNet: pENet, ecomTcs: pETcs, ecomPlatforms: pEPlt,
            driveLink: pDrv, updatedAt: pUpd, b2bSellers: b2bArr, ecoList: ecoArr, docCollected: pDocC,
            gstr2bNotGenerated: p2bSt.indexOf('NOT') === 0
          };
        })()
      });
    }
  });

  var props = PropertiesService.getScriptProperties();
  var cloudPin = props.getProperty('APP_PIN') || '123456';
  var vaultSalt = props.getProperty('VAULT_SALT') || '';
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', appPin: cloudPin, vaultSalt: vaultSalt, clients: result, feeData: feeData }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 4. handleSyncAction: Header-aware Sahi Column par likhna (Formulas preserve rakhna) + PIN save karna
function handleSyncAction(ss, data) {
  if (data && data.action === 'scanGstCerts') { return scanGstCertFolder(data); }
  if (data && data.action === 'setGstCertFolder') { return setGstCertFolder(data); }
  if (!data) return { status: 'error', message: 'Empty or invalid payload' };

  if (data.action === 'savePin' && data.pin) {
    PropertiesService.getScriptProperties().setProperty('APP_PIN', String(data.pin));
    return { status: 'ok', pinSaved: true };
  }

  if (data.action === 'saveVaultSalt' && data.salt) {
    PropertiesService.getScriptProperties().setProperty('VAULT_SALT', String(data.salt));
    return { status: 'ok', vaultSaltSaved: true };
  }

  if (data.action === 'syncAllPasswords') {
    var pwLock = LockService.getScriptLock();
    try { pwLock.waitLock(15000); } catch (le) { return { status: 'error', message: 'Sheet busy (Lock timeout)' }; }
    try {
      if (data.vaultSalt) {
        PropertiesService.getScriptProperties().setProperty('VAULT_SALT', String(data.vaultSalt));
      }
      var items = Array.isArray(data.items) ? data.items : [];
      var updatedCount = 0;
      ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
        var sh = ss.getSheetByName(tabName);
        if (!sh) return;
        var tabCols = getTabCols(sh);
        var pwCol = ensurePasswordColumn(sh, tabCols);
        var lastR = sh.getLastRow();
        if (lastR < 2) return;
        var nameVals = sh.getRange(2, tabCols.client, lastR - 1, 1).getDisplayValues();
        var gstVals = tabCols.gstin > 0 ? sh.getRange(2, tabCols.gstin, lastR - 1, 1).getDisplayValues() : [];
        var byName = {};
        var byGstin = {};
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (it.category && it.category !== tabName) continue;
          var cn = cleanClientName(it.client);
          var cg = String(it.gstin || '').trim().toUpperCase();
          if (cn) byName[cn] = String(it.password || '');
          if (cg) byGstin[cg] = String(it.password || '');
        }
        var curPwVals = sh.getRange(2, pwCol, lastR - 1, 1).getValues();
        var changedAny = false;
        for (var r = 0; r < nameVals.length; r++) {
          var rn = cleanClientName(nameVals[r][0]);
          var rg = (gstVals[r] && gstVals[r][0]) ? String(gstVals[r][0]).trim().toUpperCase() : '';
          var nextPw = (rg && byGstin.hasOwnProperty(rg)) ? byGstin[rg] : (rn && byName.hasOwnProperty(rn) ? byName[rn] : null);
          if (nextPw !== null && nextPw !== '' && String(curPwVals[r][0] || '') !== nextPw) {
            curPwVals[r][0] = nextPw;
            changedAny = true;
            updatedCount++;
          }
        }
        if (changedAny) sh.getRange(2, pwCol, lastR - 1, 1).setValues(curPwVals);
      });
      SpreadsheetApp.flush();
      return { status: 'ok', updatedPasswords: updatedCount };
    } finally {
      try { pwLock.releaseLock(); } catch (e3) {}
    }
  }

  if (data.action === 'savePortalClientData') {
    var pLock = LockService.getScriptLock();
    try { pLock.waitLock(15000); } catch (le) { return { status: 'error', message: 'Sheet busy (Lock timeout)' }; }
    try {
      var tabsToCheck = data.category ? [data.category, data.category === 'Apne' ? 'PAID CLINTS' : 'Apne'] : ['PAID CLINTS', 'Apne'];
      var targetSheet = null;
      var targetCols = null;
      var targetRow = 0;
      var targetTab = '';
      var wantClean = cleanClientName(data.client);
      var wantGstin = String(data.gstin || '').trim().toUpperCase();

      for (var t = 0; t < tabsToCheck.length && !targetRow; t++) {
        var sh = ss.getSheetByName(tabsToCheck[t]);
        if (!sh || sh.getLastRow() < 2) continue;
        var cMap = getTabCols(sh);
        var lastR = sh.getLastRow();
        var nVals = sh.getRange(2, cMap.client, lastR - 1, 1).getDisplayValues();
        var gVals = cMap.gstin > 0 ? sh.getRange(2, cMap.gstin, lastR - 1, 1).getDisplayValues() : [];
        for (var r = 0; r < nVals.length; r++) {
          var rg = (gVals[r] && gVals[r][0]) ? String(gVals[r][0]).trim().toUpperCase() : '';
          var rn = cleanClientName(nVals[r][0]);
          if ((wantGstin && rg && rg === wantGstin) || (wantClean && rn && rn === wantClean)) {
            targetSheet = sh;
            targetCols = cMap;
            targetRow = r + 2;
            targetTab = tabsToCheck[t];
            break;
          }
        }
      }
      if (!targetSheet || !targetRow) {
        return { status: 'error', message: 'Client row GST Details Sheet me nahi mili: ' + (data.client || data.gstin || '') };
      }

      ensurePortalColumns(targetSheet, targetCols);

      var driveLink = '';
      var existingDrive = targetCols.gstr2bDriveLink > 0 ? String(targetSheet.getRange(targetRow, targetCols.gstr2bDriveLink).getDisplayValue() || '').trim() : '';
      if (data.saveDrive && data.gstr2bJsonBase64) {
        try {
          var folder = getClientFolder(data.client, targetTab, true);
          if (folder) {
            var fname = data.gstr2bFileName || ('GSTR2B_' + (wantGstin || wantClean) + '_' + String(data.period || '').replace(/[^A-Za-z0-9_-]/g, '') + '.json');
            var rawB64 = String(data.gstr2bJsonBase64).indexOf(',') >= 0 ? String(data.gstr2bJsonBase64).split(',')[1] : String(data.gstr2bJsonBase64);
            var blob = Utilities.newBlob(Utilities.base64Decode(rawB64), 'application/json', fname);
            var oldFiles = folder.getFilesByName(fname);
            while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);
            var createdFile = folder.createFile(blob);
            driveLink = createdFile.getUrl();
          }
        } catch (de) {}
      } else {
        driveLink = existingDrive;
      }

      var nowStr = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm');
      targetSheet.getRange(targetRow, targetCols.portalPeriod).setValue(String(data.period || ((data.fy || '') + ' / ' + (data.month || ''))));
      targetSheet.getRange(targetRow, targetCols.portalNoticesCount).setValue(Number(data.noticesCount || 0));
      targetSheet.getRange(targetRow, targetCols.portalNotices).setValue(String(data.noticesSummary || ''));
      targetSheet.getRange(targetRow, targetCols.gstr2bIgst).setValue(Number(data.igst || 0));
      targetSheet.getRange(targetRow, targetCols.gstr2bCgst).setValue(Number(data.cgst || 0));
      targetSheet.getRange(targetRow, targetCols.gstr2bSgst).setValue(Number(data.sgst || 0));
      targetSheet.getRange(targetRow, targetCols.gstr2bCess).setValue(Number(data.cess || 0));
      targetSheet.getRange(targetRow, targetCols.gstr2bIneligible).setValue(Number(data.ineligible || 0));
      targetSheet.getRange(targetRow, targetCols.gstr2bSuppliers).setValue(Number(data.suppliers || 0));
      targetSheet.getRange(targetRow, targetCols.ecomGross).setValue(Number(data.ecomGross || 0));
      targetSheet.getRange(targetRow, targetCols.ecomNet).setValue(Number(data.ecomNet || 0));
      targetSheet.getRange(targetRow, targetCols.ecomTcs).setValue(Number(data.ecomTcs || 0));
      targetSheet.getRange(targetRow, targetCols.ecomPlatforms).setValue(String(data.ecomPlatforms || ''));
      if (targetCols.b2bSellersJson > 0) targetSheet.getRange(targetRow, targetCols.b2bSellersJson).setValue(String(data.b2bSellersJson || ''));
      if (targetCols.ecoListJson > 0) targetSheet.getRange(targetRow, targetCols.ecoListJson).setValue(String(data.ecoListJson || ''));
      targetSheet.getRange(targetRow, targetCols.gstr2bDriveLink).setValue(driveLink);
      targetSheet.getRange(targetRow, targetCols.portalUpdatedAt).setValue(nowStr);
      if (targetCols.gstr2bStatus > 0) targetSheet.getRange(targetRow, targetCols.gstr2bStatus).setValue(String(data.gstr2bStatus || ''));
      if (targetCols.docCollected > 0 && data.docCollected !== undefined) {
        var pDocCell = targetSheet.getRange(targetRow, targetCols.docCollected);
        pDocCell.insertCheckboxes();
        pDocCell.setValue(Boolean(data.docCollected));
      }
      SpreadsheetApp.flush();

      return { status: 'ok', row: targetRow, tab: targetTab, driveLink: driveLink, updatedAt: nowStr };
    } finally {
      try { pLock.releaseLock(); } catch (e4) {}
    }
  }

  if (data.action === 'saveDocCollected') {
    var dLock = LockService.getScriptLock();
    try { dLock.waitLock(15000); } catch (le) { return { status: 'error', message: 'Sheet busy (Lock timeout)' }; }
    try {
      var dTabs = data.category ? [data.category, data.category === 'Apne' ? 'PAID CLINTS' : 'Apne'] : ['PAID CLINTS', 'Apne'];
      var dSheet = null, dCols = null, dRow = 0;
      var wClean = cleanClientName(data.client);
      var wGst = String(data.gstin || '').trim().toUpperCase();
      for (var t = 0; t < dTabs.length && !dRow; t++) {
        var sh = ss.getSheetByName(dTabs[t]);
        if (!sh || sh.getLastRow() < 2) continue;
        var cMap = getTabCols(sh);
        var lastR = sh.getLastRow();
        var nVals = sh.getRange(2, cMap.client, lastR - 1, 1).getDisplayValues();
        var gVals = cMap.gstin > 0 ? sh.getRange(2, cMap.gstin, lastR - 1, 1).getDisplayValues() : [];
        for (var r = 0; r < nVals.length; r++) {
          var rg = (gVals[r] && gVals[r][0]) ? String(gVals[r][0]).trim().toUpperCase() : '';
          var rn = cleanClientName(nVals[r][0]);
          if ((wGst && rg && rg === wGst) || (wClean && rn && rn === wClean)) {
            dSheet = sh; dCols = cMap; dRow = r + 2; break;
          }
        }
      }
      if (!dSheet || !dRow) return { status: 'error', message: 'Client row nahi mili.' };
      ensurePortalColumns(dSheet, dCols);
      if (dCols.docCollected > 0) {
        var dCell = dSheet.getRange(dRow, dCols.docCollected);
        dCell.insertCheckboxes();
        dCell.setValue(Boolean(data.docCollected));
      }
      SpreadsheetApp.flush();
      return { status: 'ok', row: dRow, docCollected: Boolean(data.docCollected) };
    } finally {
      try { dLock.releaseLock(); } catch (e5) {}
    }
  }

  if (data.action === 'clearPortalDataForNewMonth') {
    var cLock = LockService.getScriptLock();
    try { cLock.waitLock(15000); } catch (le) { return { status: 'error', message: 'Sheet busy (Lock timeout)' }; }
    try {
      var clearedTabs = 0;
      var keysToClear = [
        'portalPeriod', 'portalNoticesCount', 'portalNotices',
        'gstr2bIgst', 'gstr2bCgst', 'gstr2bSgst', 'gstr2bCess', 'gstr2bIneligible', 'gstr2bSuppliers',
        'ecomGross', 'ecomNet', 'ecomTcs', 'ecomPlatforms', 'b2bSellersJson', 'ecoListJson',
        'gstr2bDriveLink', 'portalUpdatedAt', 'docCollected'
      ];
      ['PAID CLINTS', 'Apne'].forEach(function(tabName) {
        var sh = ss.getSheetByName(tabName);
        if (!sh || sh.getLastRow() < 2) return;
        var cMap = getTabCols(sh);
        var numRows = sh.getLastRow() - 1;
        keysToClear.forEach(function(k) {
          if (cMap[k] <= 0) return;
          if (k === 'docCollected') {
            var dRng = sh.getRange(2, cMap[k], numRows, 1);
            dRng.insertCheckboxes();
            dRng.setValue(false);
          } else {
            sh.getRange(2, cMap[k], numRows, 1).clearContent();
          }
        });
        clearedTabs++;
      });
      SpreadsheetApp.flush();
      return { status: 'ok', clearedTabs: clearedTabs };
    } finally {
      try { cLock.releaseLock(); } catch (e6) {}
    }
  }

  if (data.action === 'saveFeeData') {
    return saveFeeData(ss, data);
  }

  if (data.action === 'markApneFree') {
    var mRes = syncApneFreeAccountsInSheet(ss, 0);
    return { status: 'ok', apneMarkedFree: true, updatedPt: mRes.updatedPt, fixedDue: mRes.fixedDue };
  }

  if (!data.client) return { status: 'error', message: 'Client name missing' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (le) { return { status: 'error', message: 'Sheet busy (Lock timeout)' }; }

  try {
    var sheet = ss.getSheetByName(data.category || 'PAID CLINTS');
    if (!sheet) return { status: 'error', message: 'Tab nahi mila: ' + (data.category || 'PAID CLINTS') };

    var cols = getTabCols(sheet);
    var ssTz = (ss && ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : '') || (typeof Session !== 'undefined' && Session.getScriptTimeZone ? Session.getScriptTimeZone() : '') || 'Asia/Kolkata';
    var sheetClientType = data.clientType === 'Regular Client' ? 'Regular' : 'Etsy';
    var isEtsy = (sheetClientType === 'Etsy');
    var maxCheckRow = Math.min(Math.max(sheet.getLastRow(), 300), 1000);
    var names = sheet.getRange(1, cols.client, maxCheckRow, 1).getValues();

    var parentFolder = null;
    try { parentFolder = DriveApp.getFolderById(CLIENTS_FOLDER_ID); } catch(err) {}

    if (data.action === 'update') {
      var wantName = String(data.client || '').trim().toUpperCase();
      var wantClean = cleanClientName(data.client);
      var matchedRow = 0;
      for (var i = 1; i < names.length; i++) {
        var existingName = String(names[i][0] || '').trim().toUpperCase();
        if (existingName && existingName === wantName) {
          matchedRow = i + 1;
          break;
        }
      }
      if (!matchedRow && wantClean) {
        for (var j = 1; j < names.length; j++) {
          if (cleanClientName(names[j][0]) === wantClean) {
            matchedRow = j + 1;
            break;
          }
        }
      }
      if (matchedRow) {
        var rowNum = matchedRow;
        sheet.getRange(rowNum, cols.client).setValue(data.client);
        sheet.getRange(rowNum, cols.id).setValue(data.id);
        sheet.getRange(rowNum, cols.gstin).setValue(data.gstin);
        sheet.getRange(rowNum, cols.firm).setValue(data.firm);
        sheet.getRange(rowNum, cols.mobile).setValue(data.mobile);
        sheet.getRange(rowNum, cols.filed).setValue(Boolean(data.filed));

        var ptCell = sheet.getRange(rowNum, cols.ptDate);
        var parsedPt = parsePtDateValue(data.ptDate, ssTz);
        if ((data.category === 'Apne') && (!parsedPt || parsedPt === 'FREE')) {
          ptCell.setNumberFormat('@');
          ptCell.setValue('FREE');
          ptCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
        } else {
          ptCell.setValue(parsedPt);
          if (parsedPt instanceof Date) {
            ptCell.setBackground(null).setFontColor(null).setFontWeight('normal');
            ptCell.setNumberFormat('d"-"mmm"-"yyyy');
          }
        }

        ensureDueMonFormula(sheet, rowNum, cols);

        sheet.getRange(rowNum, cols.noticeStatus).setValue(data.noticeStatus || '');
        sheet.getRange(rowNum, cols.noticeDate).setValue(data.noticeDate || '');

        ensureRovColumn(sheet, cols);
        if (cols.rov > 0) {
          var rovCell = sheet.getRange(rowNum, cols.rov);
          if (!rovCell.getFormula()) {
            rovCell.setValue(Number(data.rov) || 0);
          }
        }

        if (cols.reference > 0) sheet.getRange(rowNum, cols.reference).setValue(data.reference || '');
        if (cols.address > 0) sheet.getRange(rowNum, cols.address).setValue(data.address || '');
        if (cols.clientType > 0) sheet.getRange(rowNum, cols.clientType).setValue(sheetClientType);
        if (data.password !== undefined) {
          ensurePasswordColumn(sheet, cols);
          if (cols.password > 0) sheet.getRange(rowNum, cols.password).setValue(String(data.password || ''));
        }

        ensureStatusFormula(sheet, rowNum, data.status, cols);
        SpreadsheetApp.flush();
        return { status: 'ok', updated: true, row: rowNum };
      }
      return { status: 'error', message: 'Client row sheet me nahi mili: ' + data.client };
    } else if (data.action === 'add') {
      var wantAddClean = cleanClientName(data.client);
      for (var k = 1; k < names.length; k++) {
        if (cleanClientName(names[k][0]) === wantAddClean && wantAddClean) {
          return { status: 'ok', duplicate: true, row: k + 1 };
        }
      }

      var targetRow = names.length + 1;
      for (var r = 1; r < names.length; r++) {
        var val = String(names[r][0] || '').trim();
        if (!val || val === '0' || val === 'None') {
          targetRow = r + 1;
          break;
        }
      }

      var parsedNewPt = parsePtDateValue(data.ptDate, ssTz);
      var parsedRDate = parsePtDateValue(data.rDate, ssTz);
      if (cols.sr > 0) {
        var srCell = sheet.getRange(targetRow, cols.sr);
        if (!srCell.getFormula() && (srCell.getValue() === '' || srCell.getValue() === null)) {
          srCell.setValue(data.sheetSr || (targetRow - 1));
        }
      }
      sheet.getRange(targetRow, cols.client).setValue(data.client);
      sheet.getRange(targetRow, cols.id).setValue(data.id);
      sheet.getRange(targetRow, cols.gstin).setValue(data.gstin);
      sheet.getRange(targetRow, cols.firm).setValue(data.firm);
      sheet.getRange(targetRow, cols.mobile).setValue(data.mobile);
      if (cols.rDate > 0) {
        var rDateCell = sheet.getRange(targetRow, cols.rDate);
        rDateCell.setValue(parsedRDate || '');
        if (parsedRDate instanceof Date) rDateCell.setNumberFormat('d"-"mmm"-"yyyy');
      }
      sheet.getRange(targetRow, cols.filed).setValue(Boolean(data.filed));
      var addPtCell = sheet.getRange(targetRow, cols.ptDate);
      if ((data.category === 'Apne') && (!parsedNewPt || parsedNewPt === 'FREE')) {
        addPtCell.setNumberFormat('@');
        addPtCell.setValue('FREE');
        addPtCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
      } else {
        addPtCell.setValue(parsedNewPt);
        if (parsedNewPt instanceof Date) {
          addPtCell.setBackground(null).setFontColor(null).setFontWeight('normal');
          addPtCell.setNumberFormat('d"-"mmm"-"yyyy');
        }
      }

      ensureDueMonFormula(sheet, targetRow, cols);

      sheet.getRange(targetRow, cols.noticeStatus).setValue(data.noticeStatus || '');
      sheet.getRange(targetRow, cols.noticeDate).setValue(data.noticeDate || '');

      if (cols.reference > 0) sheet.getRange(targetRow, cols.reference).setValue(data.reference || '');
      if (cols.address > 0) sheet.getRange(targetRow, cols.address).setValue(data.address || '');
      if (cols.clientType > 0) sheet.getRange(targetRow, cols.clientType).setValue(sheetClientType);
      if (data.password !== undefined) {
        ensurePasswordColumn(sheet, cols);
        if (cols.password > 0) sheet.getRange(targetRow, cols.password).setValue(String(data.password || ''));
      }

      ensureStatusFormula(sheet, targetRow, data.status, cols);

      var createdStmtId = '';
      if (parentFolder) {
        try {
          var clean = data.client.replace(/\*/g, '').trim();
          var it = parentFolder.getFoldersByName(clean);
          var f = it.hasNext() ? it.next() : parentFolder.createFolder(clean);
          if (cols.folderId > 0) sheet.getRange(targetRow, cols.folderId).setValue(f.getId());
          if (isEtsy) {
            var cp = DriveApp.getFileById(ETSY_MASTER_TEMPLATE_ID).makeCopy(clean + ' Master Etsy Statement', f);
            createdStmtId = cp.getId();
            if (cols.statementId > 0) sheet.getRange(targetRow, cols.statementId).setValue(createdStmtId);
          }
        } catch(fe) {}
      }

      ensureRovColumn(sheet, cols);
      if (cols.rov > 0) {
        var addRovCell = sheet.getRange(targetRow, cols.rov);
        if (!addRovCell.getFormula()) {
          if (createdStmtId) {
            addRovCell.setFormula('=IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + createdStmtId + '",TEXT(TODAY(),"mmmyy")&"!D5")');
          } else {
            addRovCell.setValue(Number(data.rov) || 0);
          }
        }
      }
      SpreadsheetApp.flush();
      return { status: 'ok', added: true, row: targetRow, statementId: createdStmtId };
    }
    return { status: 'error', message: 'Unknown action: ' + data.action };
  } catch (err) {
    return { status: 'error', message: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// 4B. Live 2-Way Master Etsy File Reader & Writer (Web App <-> Client Master Etsy Sheet)
function parseMasterSheetDate(val, tz) {
  if (val === null || val === undefined || val === '') return '';
  var zone = tz || (typeof Session !== 'undefined' && Session && Session.getScriptTimeZone ? Session.getScriptTimeZone() : '') || 'Asia/Kolkata';
  if (val instanceof Date && !isNaN(val.getTime())) {
    if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.formatDate === 'function') {
      var isoFromDate = Utilities.formatDate(val, zone, 'yyyy-MM-dd');
      var dp = isoFromDate.split('-');
      return makeSheetDate(dp[0], dp[1], dp[2], zone);
    }
    return makeSheetDate(val.getFullYear(), val.getMonth() + 1, val.getDate(), zone);
  }
  var s = String(val).trim();
  if (!s) return '';
  var mIso = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (mIso) {
    return makeSheetDate(Number(mIso[1]), Number(mIso[2]), Number(mIso[3]), zone);
  }
  var mDmy = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (mDmy) {
    var d = Number(mDmy[1]), mo = Number(mDmy[2]), yr = Number(mDmy[3]);
    if (yr < 100) yr += 2000;
    if (mo > 12 && d <= 12) { var tmp = d; d = mo; mo = tmp; }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return makeSheetDate(yr, mo, d, zone);
    }
  }
  var months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  var mMon = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,})[-\/\s](\d{2,4})$/);
  if (mMon) {
    var mi = months[mMon[2].slice(0, 3).toLowerCase()];
    var y2 = Number(mMon[3]);
    if (y2 < 100) y2 += 2000;
    if (mi !== undefined) return makeSheetDate(y2, mi, Number(mMon[1]), zone);
  }
  return s;
}

function ensureGrossOrderLinkIfBlank(tab, totalRow) {
  var changed = false;
  try {
    var wantD4 = '=IF(I' + totalRow + '>0,I' + totalRow + ',SUM(E4:P4))';
    var d4Cell = tab.getRange('D4');
    var d4Formula = String(d4Cell.getFormula() || '').toUpperCase().replace(/\s+/g, '');
    var isDefaultOrStale = (!d4Formula || d4Formula === '=SUM(E4:P4)' || /^=IF\(I\d+>0,I\d+,SUM\(E4:P4\)\)$/.test(d4Formula));
    if (isDefaultOrStale && d4Formula !== wantD4) {
      d4Cell.setFormula(wantD4);
      changed = true;
    }
    var e4Cell = tab.getRange('E4');
    var e4Formula = String(e4Cell.getFormula() || '').toUpperCase().replace(/\s+/g, '');
    if (/^=I\d+$/.test(e4Formula)) {
      e4Cell.clearContent();
    }
    var d5Cell = tab.getRange('D5');
    if (!String(d5Cell.getFormula() || '').trim()) {
      d5Cell.setFormula('=C4+D4-D8');
    }
  } catch (e) {}
  return changed;
}

function formatSheetDateDisplay(rawCell, dispCell, tz) {
  if (rawCell instanceof Date && !isNaN(rawCell.getTime())) {
    return Utilities.formatDate(rawCell, tz, 'dd/MM/yyyy');
  }
  return String(dispCell || '').trim();
}

function readMasterEtsyFull(data) {
  try {
    var clientClean = String(data.client || '').replace(/\*/g, '').trim();
    var file = findClientMasterEtsyFile(clientClean, data.category);
    if (!file) return { status: 'error', message: clientClean + ' ki Master Etsy Statement Drive me nahi mili.' };
    var ss = SpreadsheetApp.open(file);
    var tz = ss.getSpreadsheetTimeZone() || 'Asia/Kolkata';
    var tabsData = {};
    var tabNames = ['Apr25','May25','Jun25','Jul25','Aug25','Sep25','Oct25','Nov25','Dec25','Jan26','Feb26','Mar26','Apr26','May26','Jun26','Jul26','Aug26','Sep26','Oct26','Nov26','Dec26','Jan27','Feb27','Mar27','Apr27','May27','Jun27','Jul27','Aug27','Sep27','Oct27','Nov27','Dec27','Jan28','Feb28','Mar28','Apr28','May28','Jun28','Jul28','Aug28','Sep28','Oct28','Nov28','Dec28','Jan29','Feb29','Mar29'];
    tabNames.forEach(function(tName) {
      var sh = ss.getSheetByName(tName);
      if (!sh) return;
      var maxR = Math.min(Math.max(sh.getLastRow(), 115), 500);
      var rng = sh.getRange(1, 1, maxR, 16);
      var dispVals = rng.getDisplayValues();
      var rawVals = rng.getValues();
      var epFormulas = sh.getRange(4, 5, 1, 12).getFormulas()[0];
      var manualGov = 0;
      for (var ep = 0; ep < 12; ep++) {
        var epf = String(epFormulas[ep] || '').toUpperCase().replace(/\s+/g, '');
        if (/^=I\d+$/.test(epf)) continue;
        var epv = Number(String(rawVals[3][4 + ep] || '0').replace(/,/g, ''));
        if (!isNaN(epv)) manualGov += epv;
      }
      manualGov = Math.round(manualGov * 100) / 100;

      var orders = [];
      var totalRowIdx = 74; // 0-based default row 75
      for (var r = 44; r < dispVals.length; r++) {
        if (String(dispVals[r][0]).indexOf('*****') === 0) {
          totalRowIdx = r;
          break;
        }
        if (dispVals[r][0] || dispVals[r][1] || dispVals[r][2]) {
          orders.push({
            row: r + 1,
            payDate: formatSheetDateDisplay(rawVals[r][0], dispVals[r][0], tz),
            orderNo: String(dispVals[r][1] || '').trim(),
            gross: Number(String(dispVals[r][2]).replace(/,/g,'')) || 0,
            refund: Number(String(dispVals[r][3]).replace(/,/g,'')) || 0,
            buyerTax: Number(String(dispVals[r][4]).replace(/,/g,'')) || 0,
            taxRefund: Number(String(dispVals[r][5]).replace(/,/g,'')) || 0,
            tcs: Number(String(dispVals[r][6]).replace(/,/g,'')) || 0,
            tds: Number(String(dispVals[r][7]).replace(/,/g,'')) || 0,
            invNo: String(dispVals[r][9] || '').trim(),
            invDate: formatSheetDateDisplay(rawVals[r][10], dispVals[r][10], tz),
            country: String(dispVals[r][11] || '').trim(),
            hsn: String(dispVals[r][12] || '5703').trim(),
            sb: String(dispVals[r][13] || '').trim()
          });
        }
      }

      var invMeta = {};
      for (var ti = 8; ti < 38 && ti < dispVals.length; ti++) {
        var topInvNo = String(dispVals[ti][1] || '').trim();
        if (!topInvNo) continue;
        var rateRaw = rawVals[ti][5];
        var parsedRateTxt = parseFloat(String(dispVals[ti][5]).replace('%',''));
        var ratePct = (typeof rateRaw === 'number') ? Math.round(rateRaw * 10000) / 100 : (isNaN(parsedRateTxt) ? 5 : parsedRateTxt);
        invMeta[topInvNo] = {
          rate: ratePct,
          portCode: String(dispVals[ti][8] || '').trim(),
          sbNo: String(dispVals[ti][9] || '').trim(),
          sbDate: formatSheetDateDisplay(rawVals[ti][10], dispVals[ti][10], tz),
          csNcs: String(dispVals[ti][11] || 'NCS').trim() || 'NCS'
        };
      }

      var fees = {};
      for (var q = totalRowIdx; q < dispVals.length; q++) {
        var lb = String(dispVals[q][0] || '').toLowerCase();
        if (lb.indexOf('etsy ads') === 0) fees.ads = [Number(String(dispVals[q][1]).replace(/,/g,''))||0, Number(String(dispVals[q][2]).replace(/,/g,''))||0];
        else if (lb.indexOf('transaction fee') === 0) fees.transaction = [Number(String(dispVals[q][1]).replace(/,/g,''))||0, Number(String(dispVals[q][2]).replace(/,/g,''))||0];
        else if (lb.indexOf('processing fee') === 0) fees.processing = [Number(String(dispVals[q][1]).replace(/,/g,''))||0, Number(String(dispVals[q][2]).replace(/,/g,''))||0];
        else if (lb.indexOf('regulatory') === 0) fees.regulatory = [Number(String(dispVals[q][1]).replace(/,/g,''))||0, Number(String(dispVals[q][2]).replace(/,/g,''))||0];
        else if (lb.indexOf('listing fee') === 0) fees.listing = [Number(String(dispVals[q][1]).replace(/,/g,''))||0, Number(String(dispVals[q][2]).replace(/,/g,''))||0];
        else if (lb.indexOf('other fee') === 0) fees.other = [Number(String(dispVals[q][1]).replace(/,/g,''))||0, Number(String(dispVals[q][2]).replace(/,/g,''))||0];
      }
      tabsData[tName] = { orders: orders, fees: fees, invMeta: invMeta, manualGov: manualGov };
    });
    return { status: 'ok', url: file.getUrl(), tabs: tabsData };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}

function writeSingleMasterTab(ss, tabPayload) {
  var tabName = tabPayload.tab;
  if (!tabName) return;
  var tz = (ss && ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : '') || (typeof Session !== 'undefined' && Session.getScriptTimeZone ? Session.getScriptTimeZone() : '') || 'Asia/Kolkata';
  var tab = ss.getSheetByName(tabName);
  if (!tab) {
    var tmpl = ss.getSheetByName('Mar27') || ss.getSheetByName('Apr26');
    if (!tmpl) throw new Error(tabName + ' tab nahi mila.');
    tab = tmpl.copyTo(ss).setName(tabName);
    tab.getRange(45, 1, 30, 8).clearContent();
    tab.getRange(45, 10, 30, 3).clearContent();
    tab.getRange(45, 14, 30, 1).clearContent();
    if (tabPayload.prevTab) {
      tab.getRange('C4').setFormula("='" + tabPayload.prevTab + "'!D5");
    }
    if (tabPayload.fullMonthName) {
      tab.getRange('A2').setValue(tabPayload.fullMonthName);
    }
  }

  // Find ***** total row dynamically so >30 orders never clip or overwrite fees
  var lastCol = Math.max(tab.getLastColumn(), 14);
  var maxRows = tab.getMaxRows();
  var colADisp = tab.getRange(ETSY_FIRST_ROW, 1, maxRows - ETSY_FIRST_ROW + 1, 1).getDisplayValues();
  var totalRow = 75;
  for (var tr = 0; tr < colADisp.length; tr++) {
    if (String(colADisp[tr][0]).indexOf('*****') === 0) {
      totalRow = ETSY_FIRST_ROW + tr;
      break;
    }
  }

  var orders = Array.isArray(tabPayload.orders) ? tabPayload.orders : [];
  var cap = totalRow - ETSY_FIRST_ROW;
  if (orders.length > cap && totalRow > ETSY_FIRST_ROW) {
    var extra = orders.length - cap;
    var lastDataRow = totalRow - 1;
    tab.insertRowsBefore(lastDataRow, extra);
    var srcRow = lastDataRow + extra;
    var src = tab.getRange(srcRow, 1, 1, lastCol);
    var dst = tab.getRange(lastDataRow, 1, extra, lastCol);
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    var fr = src.getFormulasR1C1()[0];
    for (var fc = 8; fc < lastCol; fc++) {
      if (fr[fc] && String(fr[fc]).charAt(0) === '=') {
        tab.getRange(lastDataRow, fc + 1, extra, 1).setFormulaR1C1(fr[fc]);
      }
    }
    totalRow += extra;
    cap = totalRow - ETSY_FIRST_ROW;
  }

  // 1. Write Orders (A..H, J..L, N) — real Date objects so ISNUMBER(k) in Top Invoice LET/VSTACK passes!
  // Guard: never overwrite existing non-empty sheet orders if orders array is empty (unless allowEmptyClear is explicitly true)
  var hasExistingSheetOrders = false;
  for (var hc = 0; hc < cap; hc++) {
    if (colADisp[hc] && String(colADisp[hc][0] || '').trim() !== '' && String(colADisp[hc][0]).indexOf('*****') !== 0) { hasExistingSheetOrders = true; break; }
  }
  if (cap > 0 && (orders.length > 0 || tabPayload.allowEmptyClear || !hasExistingSheetOrders)) {
    var ahRows = [];
    var jlRows = [];
    var nRows = [];
    for (var i = 0; i < cap; i++) {
      var o = orders[i];
      if (o && (o.orderNo || o.gross || o.payDate || o.invDate)) {
        var payDt = parseMasterSheetDate(o.payDate, tz);
        var invDt = parseMasterSheetDate(o.invDate, tz);
        ahRows.push([
          payDt || '',
          o.orderNo ? (isNaN(Number(o.orderNo)) ? String(o.orderNo) : Number(o.orderNo)) : '',
          Number(o.gross) || 0,
          Number(o.refund) || 0,
          Number(o.buyerTax) || 0,
          Number(o.taxRefund) || 0,
          Number(o.tcs) || 0,
          Number(o.tds) || 0
        ]);
        jlRows.push([
          o.invNo || '',
          invDt || '',
          o.country || ''
        ]);
        nRows.push([o.sb || '']);
      } else {
        ahRows.push(['', '', '', '', '', '', '', '']);
        jlRows.push(['', '', '']);
        nRows.push(['']);
      }
    }
    tab.getRange(ETSY_FIRST_ROW, 1, cap, 8).setValues(ahRows);
    tab.getRange(ETSY_FIRST_ROW, 10, cap, 3).setValues(jlRows);
    tab.getRange(ETSY_FIRST_ROW, 14, cap, 1).setValues(nRows);
    tab.getRange(ETSY_FIRST_ROW, 1, cap, 1).setNumberFormat('dd/mm/yyyy');
    tab.getRange(ETSY_FIRST_ROW, 11, cap, 1).setNumberFormat('dd/mm/yyyy');
  }

  if (orders.length === 0 && tabPayload.manualGov !== undefined) {
    var mg = Number(tabPayload.manualGov) || 0;
    if (mg > 0) {
      tab.getRange('E4').setValue(mg);
    } else if (!String(tab.getRange('E4').getFormula() || '').trim()) {
      tab.getRange('E4').clearContent();
    }
  }

  ensureGrossOrderLinkIfBlank(tab, totalRow);

  // 2. Write Top Invoice Table overrides (F9:F38 Tax Rate, I9:K38 Port/SB, L9:L38 only if overridden)
  if (Array.isArray(tabPayload.topInvoices)) {
    var lFormulas = tab.getRange(9, 12, 30, 1).getFormulas();
    tabPayload.topInvoices.forEach(function(inv, idx) {
      if (idx >= 30) return;
      var rowNum = 9 + idx;
      if (inv.rate !== undefined) tab.getRange(rowNum, 6).setValue(Number(inv.rate) / 100);
      var sbDt = parseMasterSheetDate(inv.sbDate, tz);
      tab.getRange(rowNum, 9, 1, 3).setValues([[inv.portCode || '', inv.sbNo || '', sbDt || '']]);
      if (sbDt instanceof Date) tab.getRange(rowNum, 11).setNumberFormat('dd/mm/yyyy');
      if (inv.csNcs) {
        if (!lFormulas[idx][0] || inv.csNcs !== 'NCS') {
          tab.getRange(rowNum, 12).setValue(inv.csNcs);
        }
      }
    });
  }

  // 3. Write Etsy Fees + GST Summary Month label starting dynamically from totalRow
  var afterRows = tab.getRange(totalRow, 1, tab.getMaxRows() - totalRow + 1, 1).getValues();
  if (tabPayload.fees) {
    var rules = [['ads','etsy ads'],['transaction','transaction fee'],['processing','processing fee'],['regulatory','regulatory'],['listing','listing fee'],['other','other fee']];
    rules.forEach(function(rl) {
      var f = tabPayload.fees[rl[0]];
      if (!f) return;
      for (var q = 0; q < afterRows.length; q++) {
        if (String(afterRows[q][0]).toLowerCase().trim().indexOf(rl[1]) === 0) {
          tab.getRange(totalRow + q, 2, 1, 2).setValues([[Number(f.charged)||0, Number(f.credits)||0]]);
          break;
        }
      }
    });
  }
  if (tabPayload.fullMonthName) {
    for (var z = 0; z < afterRows.length; z++) {
      if (String(afterRows[z][0]).toLowerCase().trim() === 'month') {
        var mc = tab.getRange(totalRow + z, 2);
        if (String(mc.getValue()).trim() === '') mc.setValue(tabPayload.fullMonthName);
        break;
      }
    }
  }
}

// ROV column auto-create: Balance sheet (main tracker) me ROV header na ho to khud bana deta hai,
// taaki har save/push par latest ROV (D5) Balance sheet me likha ja sake.
function ensureRovColumn(sheet, cols) {
  if (!sheet) return 0;
  if (cols.rov > 0) return cols.rov;
  var lastC = Math.max(sheet.getLastColumn(), 1);
  var hdrs = sheet.getRange(1, 1, 1, lastC).getDisplayValues()[0] || [];
  var blank = 0;
  for (var c = 0; c < hdrs.length; c++) {
    var k = String(hdrs[c] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k === 'rov' || k.indexOf('rov') === 0 || k === 'returnonvalue' || k === 'returnvalue' || k.indexOf('returnon') === 0) { cols.rov = c + 1; return cols.rov; }
    if (!blank && !String(hdrs[c] || '').trim()) blank = c + 1;
  }
  var target = lastC + 1;
  // Khaali header wala column sirf tabhi use karein jab uske neeche ka data bhi khaali ho,
  // warna kisi data-column ka header ROV se overwrite ho jaata.
  if (blank) {
    var lastR = sheet.getLastRow();
    var empty = true;
    if (lastR > 1) {
      var below = sheet.getRange(2, blank, lastR - 1, 1).getValues();
      for (var b = 0; b < below.length; b++) {
        if (String(below[b][0] === null || below[b][0] === undefined ? '' : below[b][0]).trim()) { empty = false; break; }
      }
    }
    if (empty) target = blank;
  }
  if (target > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), target - sheet.getMaxColumns());
  sheet.getRange(1, target).setValue('ROV');
  cols.rov = target;
  cols.maxCol = Math.max(Number(cols.maxCol) || 0, target);
  return target;
}

function saveMasterEtsyTab(data) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { status: 'error', message: 'Script busy' }; }
  try {
    var clientClean = String(data.client || '').replace(/\*/g, '').trim();
    var file = findClientMasterEtsyFile(clientClean, data.category);
    if (!file) return { status: 'error', message: 'Master Etsy file nahi mili.' };
    var ss = SpreadsheetApp.open(file);

    var syncedList = [];
    if (Array.isArray(data.tabs) && data.tabs.length > 0) {
      for (var t = 0; t < data.tabs.length; t++) {
        writeSingleMasterTab(ss, data.tabs[t]);
        if (data.tabs[t].tab) syncedList.push(data.tabs[t].tab);
      }
    } else if (data.tab) {
      writeSingleMasterTab(ss, data);
      syncedList.push(data.tab);
    }

    SpreadsheetApp.flush();

    // Sync ROV back to main tracker sheet (agar ROV column ho aur formula na ho)
    if (data.rov !== undefined) {
      var mainSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.category || 'PAID CLINTS');
      if (mainSheet) {
        var mainCols = getTabCols(mainSheet); ensureRovColumn(mainSheet, mainCols);
        if (mainCols.rov > 0) {
          var lastR = Math.min(Math.max(mainSheet.getLastRow(), 2), 500);
          var names = mainSheet.getRange(1, mainCols.client, lastR, 1).getValues();
          for (var k = 1; k < names.length; k++) {
            if (cleanClientName(names[k][0]) === clientClean.toUpperCase()) {
              var rovCell = mainSheet.getRange(k + 1, mainCols.rov);
              var newRovVal = Number(data.rov) || 0;
              if (!rovCell.getFormula() || Math.abs((Number(rovCell.getValue()) || 0) - newRovVal) > 0.005) {
                rovCell.setValue(newRovVal);
              }
              break;
            }
          }
        }
      }
    }
    return { status: 'ok', syncedTab: data.tab || syncedList.join(','), syncedTabs: syncedList };
  } catch (err) {
    return { status: 'error', message: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// 5. doPost
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = null;
  try {
    data = JSON.parse(e.postData.contents);
  } catch(err) {
    try {
      if (e && e.parameter && e.parameter.payload) {
        data = JSON.parse(decodeURIComponent(e.parameter.payload));
      }
    } catch(err2) {}
  }

  if (!data) return jsonOut({ status: 'error', message: 'Invalid JSON payload' });
  if (data.action === 'etsyStatement') { return jsonOut(processEtsyStatement(data)); }
  if (data.action === 'getEtsyMasterUrl') { return jsonOut(getEtsyMasterUrl(data)); }
  if (data.action === 'uploadDocument') { return jsonOut(uploadClientDocument(data)); }
  if (data.action === 'readMasterEtsyFull') { return jsonOut(readMasterEtsyFull(data)); }
  if (data.action === 'getAllRov') { return jsonOut(getAllRov(data)); }
  if (data.action === 'saveMasterEtsyTab') { return jsonOut(saveMasterEtsyTab(data)); }
  if (data.action === 'saveFeeData') { return jsonOut(saveFeeData(ss, data)); }
  if (data.action === 'saveGstr1Json') { return jsonOut(saveGstr1Json(data)); }
  if (data.action === 'listGstr1Json') { return jsonOut(listGstr1Json(data)); }
  if (data.action === 'readGstr1Json') { return jsonOut(readGstr1Json(data)); }
  return jsonOut(handleSyncAction(ss, data));
}
