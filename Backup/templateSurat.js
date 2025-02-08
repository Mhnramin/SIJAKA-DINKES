// Fungsi untuk mengonversi tanggal dalam format ISO 8601 menjadi format '01 Januari 2024'
function formatTanggal(tanggalString) {
  var date = new Date(tanggalString);

  // Mendapatkan tanggal
  var day = String(date.getDate()).padStart(2, "0");

  // Daftar nama bulan dalam bahasa Indonesia
  var months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  // Mendapatkan bulan (dengan penyesuaian karena bulan dimulai dari 0)
  var month = months[date.getMonth()];

  // Mendapatkan tahun
  var year = date.getFullYear();

  // Mengembalikan tanggal dalam format '01 Januari 2024'
  return day + " " + month + " " + year;
}

function doGet(e) {
  if (e.parameter.id) {
    return generatePdfForId(e.parameter.id);
  } else {
    return HtmlService.createTemplateFromFile("index.html")
      .evaluate()
      .setTitle("SIJAKA DINAS KESEHATAN")
      .setFaviconUrl("https://i.imgur.com/3UGnxUn.png")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function generatePdfForId(id) {
  var sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SuratKeterangan");
  var data = sheet.getDataRange().getValues();

  var rowData = null;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      // Mencari ID berdasarkan kolom pertama
      rowData = data[i];
      break;
    }
  }

  if (rowData) {
    // Menentukan nilai untuk penggantian
    var plat = rowData[1]; // Plat nomor
    var penanggungJawab = rowData[2]; // Penanggung jawab
    var pusban = rowData[3]; // Pusban
    var tanggalSurat = rowData[4]; // Tanggal surat
    var nomor = rowData[5]; // Nomor surat
    var tipeKendaraan = rowData[6]; // Tipe kendaraan
    var nomorRangka = rowData[7]; // Nomor rangka
    var nomorMesin = rowData[8]; // Nomor mesin
    var instansi = rowData[9]; // Instansi
    var nip = rowData[11]; // NIP
    var pangkat = rowData[12]; // Pangkat
    var penandaTangan = rowData[13]; // Penanda tangan
    var gantiPlat = rowData[14]; // Ganti plat kendaraan

    // Format tanggal
    var formattedDate = formatTanggal(tanggalSurat);
    var tahun = new Date(tanggalSurat).getFullYear();
    var reason =
      "Untuk dapat dilakukan perpanjangan Surat Tanda Kendaraan ( STNK )";

    // Menambahkan informasi tentang pergantian plat jika diperlukan
    if (gantiPlat === "Yes") {
      reason += " dan pergantian Plat Kendaraan tahun " + tahun + ".";
    } else {
      reason += " tahun " + tahun + ".";
    }
    // Menambahkan informasi tentang pergantian plat jika diperlukan
    if (pusban === "") {
      // Jika pusban null, tidak menambahkannya ke instansi
      // Jika Anda ingin menambahkannya hanya jika tidak null, Anda bisa langsung melewatkan else
    } else {
      // Jika pusban tidak null, tambahkan ke instansi
      instansi += " - " + pusban;
    }

    // ID template Google Docs
    var templateId = "17YyaXTovXjnUv4QoPSgi4WfhYmO484qMHowTqs_Cw0Y"; // Gantilah ID template Anda di sini
    var templateFolderId = "1yxMoZ7wsx0EK_m-1w6qo1bQAnYP4-9he"; // Gantilah dengan folder ID tempat Anda ingin menyimpan PDF
    var pdfUrls = [];

    try {
      // Membuat salinan dari template
      var duplicateDoc = DriveApp.getFileById(templateId).makeCopy();
      var newDocId = duplicateDoc.getId();
      var newDoc = DocumentApp.openById(newDocId);

      // Ganti placeholder dengan data dari rowData

      // Ganti placeholder dengan data dari rowData
      newDoc
        .getBody()
        .replaceText("{{penanggungJawab}}", penanggungJawab || "");
      newDoc.getBody().replaceText("{{reason}}", reason || "");
      newDoc.getBody().replaceText("{{plat}}", plat || "");
      newDoc.getBody().replaceText("{{pusban}}", pusban || "");
      newDoc.getBody().replaceText("{{tanggalSurat}}", formattedDate);
      newDoc.getBody().replaceText("{{nomor}}", nomor || "");
      newDoc.getBody().replaceText("{{tipeKendaraan}}", tipeKendaraan || "");
      newDoc.getBody().replaceText("{{nomorRangka}}", nomorRangka || "");
      newDoc.getBody().replaceText("{{nomorMesin}}", nomorMesin || "");
      newDoc.getBody().replaceText("{{instansi}}", instansi || "");
      newDoc.getBody().replaceText("{{nip}}", nip || "");
      newDoc.getBody().replaceText("{{pangkat}}", pangkat || "");
      newDoc.getBody().replaceText("{{penandaTangan}}", penandaTangan || "");
      newDoc.getBody().replaceText("{{gantiPlat}}", gantiPlat || "");

      // Mengganti placeholder tambahan jika perlu (seperti tanggal)
      newDoc.getBody().replaceText("{{tanggalSurat}}", formattedDate);

      // Simpan dan tutup dokumen baru
      newDoc.saveAndClose();

      // Mengonversi dokumen ke PDF
      var folder = DriveApp.getFolderById(templateFolderId);
      var pdfFile = DriveApp.getFileById(newDocId).getAs("application/pdf");
      var pdfName = rowData[5] || "Document_" + id; // Anda dapat mengganti ini dengan nama yang lebih spesifik

      // Simpan PDF di folder yang ditentukan
      var pdf = folder.createFile(pdfFile).setName(pdfName + ".pdf");
      var fileURL = pdf.getUrl();
      pdfUrls.push([fileURL]);

      // Hapus dokumen sementara setelah selesai
      DriveApp.getFileById(newDocId).setTrashed(true);

      // Mengembalikan URL PDF yang dihasilkan
      return fileURL;
    } catch (e) {
      Logger.log("Error: " + e.message); // Log error jika ada kesalahan
      return "Error: " + e.message;
    }
  } else {
    return "ID not found";
  }
}

// ----------Testing All ID ------------
// function testGeneratePdfForId() {
//   var testId = "2"; // Ganti dengan ID yang valid yang ada di sheet Anda
//   var result = generatePdfForId(testId);
//   Logger.log(result); // Menampilkan URL PDF atau pesan error

//   if (result.includes("https://")) {
//     Logger.log("Test passed: PDF URL generated successfully.");
//   } else {
//     Logger.log("Test failed: PDF URL is not generated correctly.");
//   }
// }
