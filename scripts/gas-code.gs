/**
 * GAS Code.gs — SOL監査訪問 Google Apps Script
 * Cập nhật: Đọc reports từ data.reports (mảng phẳng) thay vì cache lồng nhau
 * 
 * Hướng dẫn deploy:
 * 1. Mở Google Apps Script → Dán toàn bộ code này vào Code.gs
 * 2. Click "Deploy" → "New deployment" → "Web app"
 * 3. Execute as: Me | Who has access: Anyone
 * 4. Copy URL và dán vào .env.local / Vercel env
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var backupSheet = ss.getSheetByName("JSON_BACKUP");
  var data = { enterprises: [], cache: {}, reports: [] };

  if (backupSheet && backupSheet.getLastRow() > 0) {
    try {
      var jsonStr = backupSheet.getRange(1, 1).getValue();
      var parsed = JSON.parse(jsonStr);
      data = {
        enterprises: parsed.enterprises || [],
        cache: parsed.cache || {},
        reports: parsed.reports || []
      };
    } catch (err) {
      Logger.log("doGet parse error: " + err);
    }
  }

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── 1. Save full JSON to JSON_BACKUP ──
    var backupSheet = ss.getSheetByName("JSON_BACKUP");
    if (!backupSheet) backupSheet = ss.insertSheet("JSON_BACKUP");
    backupSheet.clearContents();
    backupSheet.getRange(1, 1).setValue(raw);

    // ── 2. Update Enterprises sheet ──
    var entSheet = ss.getSheetByName("Enterprises");
    if (!entSheet) entSheet = ss.insertSheet("Enterprises");
    entSheet.clearContents();
    entSheet.appendRow(["ID", "企業名", "特・実・育", "内1年目", "内1年目入国日"]);
    (data.enterprises || []).forEach(function(ent) {
      entSheet.appendRow([
        ent.id,
        ent.name,
        (ent.countTokutei || 0) + (ent.countJisshu23 || 0),
        ent.countJisshu1 || 0,
        ent.entryDateJisshu1 || ""
      ]);
    });

    // ── 3. Update Reports sheet from data.reports (flat array) ──
    var repSheet = ss.getSheetByName("Reports");
    if (!repSheet) repSheet = ss.insertSheet("Reports");
    repSheet.clearContents();
    repSheet.appendRow([
      "企業名", "月", "種類",
      "監査担当者", "監査実施日", "監査面談者",
      "給料明細", "実習日誌",
      "訪問担当者", "訪問実施日", "訪問面談者",
      "備考", "同期日時"
    ]);

    var reports = data.reports || [];

    // Fallback: if reports array is empty, extract from enterprises[].schedule
    if (reports.length === 0) {
      (data.enterprises || []).forEach(function(ent) {
        (ent.schedule || []).forEach(function(cell) {
          if (cell.status === "completed" && cell.report) {
            var r = cell.report;
            reports.push({
              entName: ent.name,
              month: cell.month,
              type: cell.type,
              staff: r.staff || "",
              date: r.date || "",
              interviewee: r.interviewee || "",
              checkSalary: r.checkSalary || "",
              checkLog: r.checkLog || "",
              vStaff: r.vStaff || "",
              vDate: r.vDate || "",
              vInterviewee: r.vInterviewee || "",
              remarks: r.remarks || ""
            });
          }
        });
      });
    }

    reports.forEach(function(r) {
      repSheet.appendRow([
        r.entName,
        r.month,
        r.type === "audit" ? "監査" : "訪問",
        r.staff || "",
        r.date || "",
        r.interviewee || "",
        r.checkSalary === "ok" ? "適正" : (r.checkSalary === "ng" ? "不備" : ""),
        r.checkLog === "ok" ? "適正" : (r.checkLog === "ng" ? "不備" : ""),
        r.vStaff || "",
        r.vDate || "",
        r.vInterviewee || "",
        r.remarks || "",
        data.timestamp || ""
      ]);
    });

    Logger.log("Sync OK: " + (data.enterprises || []).length + " enterprises, " + reports.length + " reports");

    return ContentService.createTextOutput("OK")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    Logger.log("doPost error: " + err);
    return ContentService.createTextOutput("ERROR: " + err)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
