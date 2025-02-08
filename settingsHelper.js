function recreateTahunan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToBackup = ["SuratKeterangan"]; // Ganti dengan nama sheet yang ingin Anda backup
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  sheetsToBackup.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      // Salin sheet ke spreadsheet yang sama
      const newSheetName = `${sheetName} ${lastYear}`;
      const newSheet = sheet.copyTo(ss).setName(newSheetName);

      // Hapus semua data dari sheet yang sudah ditentukan, kecuali header
      const lastRow = sheet.getLastRow();
      const lastColumn = sheet.getLastColumn();

      if (lastRow > 1) {
        // Pastikan ada data di bawah header
        const rangeToClear = sheet.getRange(2, 1, lastRow - 1, lastColumn); // Mulai dari baris 2 untuk menjaga header
        rangeToClear.clearContent(); // Hapus konten
      }
    } else {
      Logger.log(`Sheet dengan nama ${sheetName} tidak ditemukan.`);
    }
  });
}
