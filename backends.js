// This is the main code file for the web app
// This file contains the code for the server side functions
function doGet() {
  return HtmlService.createTemplateFromFile("index.html")
    .evaluate()
    .setTitle("SIJAKA DINKES")
    .setFaviconUrl("https://i.imgur.com/3UGnxUn.png")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function openApp() {
  let service = ScriptApp.getService();
  if (service.isEnabled()) {
    let ui = SpreadsheetApp.getUi();
    let url = service.getUrl().replace("/dev", "/exec");
    let html = `<script>window.open("${url}");google.script.host.close();<\/script>`;
    let userInterface = HtmlService.createTemplate(html)
      .evaluate()
      .setTitle("Opening ...");
    ui.showSidebar(userInterface);
  } else {
    SpreadsheetApp.getActive().toast(
      "Please deploy the project as web app first.",
      "Message"
    );
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Leave Approval")
    .addItem("Open app", "openApp")
    .addItem("Setup", "setUp")
    .addItem("Setup and Add Test Users", "setUpAndAddTestUsers")
    .addToUi();
}

function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}
function getPageUrl(page) {
  let url = ScriptApp.getService().getUrl().replace("/dev", "/exec");
  if (page) {
    url += "?p=" + page;
  }
  return url;
}

function createFile({ data, type, name }, folder) {
  data = Utilities.base64Decode(data);
  const blob = Utilities.newBlob(data, type, name);
  const file = folder.createFile(blob);
  return file;
}

function getFolderByName(name) {
  const id = SpreadsheetApp.getActive().getId();
  const parentFolder = DriveApp.getFileById(id).getParents().next();
  const folders = parentFolder.getFoldersByName(name);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = parentFolder.createFolder(name);
  }
  return folder;
}

// This function is used to save the Schema and app settings to the script properties by reading from the App Settings sheet and Schema sheet
const saveAppPrefs = () => {
  const obj = {};
  const settingsSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("App Settings");
  const appSettings = settingsSheet
    .getRange(1, 1, settingsSheet.getLastRow(), settingsSheet.getLastColumn())
    .getValues();
  const appSettingsHeaders = appSettings.shift();
  const appSettingsJsonArray = appSettings.map((row) => {
    return row.reduce((obj, value, index) => {
      obj[appSettingsHeaders[index]] = value;
      return obj;
    }, {});
  });
  obj.appSettings = appSettingsJsonArray[0];

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    obj.appSettings.SchemaSheet
  );

  const data = sheet
    .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
    .getValues();
  const headers = data.shift();
  const jsonArray = data.map((row) => {
    return row.reduce((obj, value, index) => {
      obj[headers[index]] = value;
      return obj;
    }, {});
  });

  //

  obj.schema = jsonArray;

  // save to script properties
  PropertiesService.getScriptProperties().setProperty(
    "appPrefs",
    JSON.stringify(obj)
  );
  return jsonArray;
};

// This function is used to get the appPrefs from the script properties
function getAppPrefs() {
  const appPrefs =
    PropertiesService.getScriptProperties().getProperty("appPrefs");
  return JSON.parse(appPrefs);
}

// Updated to handle multiple rows
function getAllSheets() {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  const sheetNames = sheets.map((sheet) => sheet.getName());
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(sheetNames)
    .build();

  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("App Settings");
  const lastRow = sheet.getLastRow();
  sheet.getRange(`D2:E${lastRow}`).setDataValidation(rule);
}

// ----------------- ORM Class -------------------
class ORM {
  constructor() {
    this.sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      getAppPrefs().appSettings.DataEntrySheet
    );
    this.ID_COL = getAppPrefs().appSettings.IdColumn;
    this.schema = getAppPrefs().schema;
  }

  // Create a new record
  create(data) {
    const id = this.getNextId() || 1;
    data[this.ID_COL] = id;

    const headers = this.sheet
      .getRange(1, 1, 1, this.sheet.getLastColumn())
      .getValues()[0];

    const newRow = [];

    for (const header of headers) {
      newRow.push(data[header] || "");
    }
    this.sheet.appendRow(newRow);
  }

  // Read all records
  readAll() {
    const dataRange = this.sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    const records = [];

    //Returning data from multi-dimensional array
    for (let i = 1; i < values.length; i++) {
      const record = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[i][j];
      }
      records.push(record);
    }
    Logger.log(records);
    return records.reverse();
  }

  // Read a specific record by ID
  readById(id) {
    const dataRange = this.sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        const record = {};
        for (let j = 0; j < headers.length; j++) {
          record[headers[j]] = values[i][j];
        }
        return record;
      }
    }
    return null;
  }

  // Update a record by ID
  updateById(data) {
    // Ambil semua data dari sheet
    const values = this.sheet
      .getRange(1, 1, this.sheet.getLastRow(), this.sheet.getLastColumn())
      .getValues();
    const headers = values[0]; // Ambil header (baris pertama)

    // Cari index baris berdasarkan ID
    const rowIndex = values.findIndex((row) => row[0] == data[this.ID_COL]);
    if (rowIndex === -1) return false; // ID tidak ditemukan

    // Ambil baris yang sudah ada
    const existingRow = this.sheet
      .getRange(rowIndex + 1, 1, 1, this.sheet.getLastColumn())
      .getValues()[0];

    // Tentukan batasan kolom berdasarkan nama sheet
    const sheetName = this.sheet.getName();
    let maxColumnIndex = this.sheet.getLastColumn(); // Default: semua kolom

    if (sheetName === "Database") {
      maxColumnIndex = 10; // Kolom A sampai J (indeks 0-9)
    } else if (sheetName === "SuratKeterangan") {
      maxColumnIndex = 5; // Kolom A sampai E (indeks 0-4)
    }

    // Update hanya kolom yang diizinkan dan bukan formula
    this.schema.forEach(({ key, type }) => {
      const columnIndex = headers.indexOf(key);
      if (columnIndex !== -1 && columnIndex < maxColumnIndex) {
        existingRow[columnIndex] = data[key];
        if (type !== "formula") {
          this.sheet
            .getRange(rowIndex + 1, columnIndex + 1)
            .setValue(data[key]);
        }
      }
    });

    return true;
  }

  // Delete a record by ID
  deleteById(record) {
    const id = record[this.ID_COL];
    const dataRange = this.sheet.getDataRange();
    const values = dataRange.getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] == id) {
        this.sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  }

  // Get the next ID
  getNextId() {
    const dataRange = this.sheet.getDataRange();
    const values = dataRange.getValues();
    let maxId = 0;
    for (let i = 1; i < values.length; i++) {
      const id = values[i][0];
      if (id > maxId) {
        maxId = id;
      }
    }
    return maxId + 1;
  }
}

const getSheetData = (name) => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  const dataRange = sheet.getDataRange();
  const data = dataRange.getDisplayValues();
  const heads = data.shift();
  const obj = data.map((r) =>
    heads.reduce((o, k, i) => ((o[k] = r[i] || ""), o), {})
  );
  return JSON.stringify(obj);
};

// ----------Callables Methods ------------

// Create a new record
function createRecord(data) {
  const orm = new ORM();
  orm.create(data);
  return readAllRecords();
}

// Read all records
function readAllRecords() {
  const orm = new ORM();
  const allRecords = orm.readAll();
  return JSON.stringify(allRecords);
}

// Read a specific record by ID
function readRecordById(recordId) {
  const orm = new ORM();
  const specificRecord = orm.readById(recordId);
}

// Update a record by ID
function updateRecordById(data) {
  const orm = new ORM();
  const isUpdated = orm.updateById(data);
  return readAllRecords();
}

// Delete a record by ID
function deleteRecord(record) {
  const orm = new ORM();
  const isDeleted = orm.deleteById(record);
  return readAllRecords();
}

// ----------Scraping SIMPATOR ------------
// Scraping function
function startScraping(id) {
  // Logger.log("Scraping started for ID:", id);

  const orm = new ORM();
  const item = orm.readById(id);

  if (!item || !item.plat) {
    // Logger.log("Invalid item provided for scraping or plat not found.");
    return;
  }

  const plat = item.plat;
  // Logger.log("Plat value:", plat);

  if (typeof plat !== "string") {
    Logger.log("Plat is not a string:", plat);
    return;
  }

  const parts = plat.split(" ");
  if (parts.length !== 3) {
    // Logger.log("Invalid plat format:", plat);
    return;
  }

  const [kt, nomor, seri] = parts;
  // Logger.log("Parsed values - KT:", kt, "Nomor:", nomor, "Seri:", seri);

  const params = {
    kt: kt,
    nomor: nomor,
    seri: seri,
  };

  scrapeData(params, id);
}

// Scraping data and updating database
function scrapeData(params, id) {
  if (!params || !params.kt || !params.nomor || !params.seri) {
    // Logger.log("Invalid scraping parameters:", params);
    return;
  }

  // Adjust the seri parameter based on the conditions
  let adjustedSeri = params.seri;
  if (params.seri === "E") {
    adjustedSeri = "E-"; // Use "E-" if the original seri is "E"
  } else if (/^E[PE]*$/.test(params.seri)) {
    // Do not modify if seri is "EP", "EE", etc.
    adjustedSeri = params.seri;
  }

  // Construct the URL for scraping
  params.seri = adjustedSeri;
  const baseUrl = "http://simpator.kaltimprov.go.id/cari.php";
  const options = {
    method: "post",
    payload: params,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    },
  };

  try {
    const response = UrlFetchApp.fetch(baseUrl, options);
    const html = response.getContentText();

    // Using regex to extract values based on IDs
    const data = {};
    const ids = ["nopol", "tg_pkb", "tg_stnk", "total"];

    ids.forEach(function (id) {
      var regex = new RegExp(
        '<input[^>]+id="' +
          id +
          '"[^>]+value=[\'"]?([^\'" >]+(?:\\s+[^\'" >]+)*)[\'"]?[^>]*>',
        "i"
      );
      var match = html.match(regex);
      if (match && match[1]) {
        data[id] = match[1].trim();
      } else {
        data[id] = ""; // Set to empty string if not found
      }
    });

    if (!data["nopol"]) {
      // Logger.log(`${params.nomor} ${params.seri} not found.`);
    } else {
      const rowData = {
        "#": id,
        tanggalMasaPajak: data["tg_pkb"] || "",
        tanggalMasaSTNK: data["tg_stnk"] || "",
        biaya: data["total"] || "",
      };

      const orm = new ORM();
      const updateResult = orm.updateById(rowData);

      if (updateResult) {
        // Logger.log("Data successfully updated for ID:", id);
      } else {
        Logger.log("Failed to update data for ID:", id);
      }
    }
  } catch (err) {
    Logger.log("Error during scraping:", err.message);
  }
}

// ----------Sending Whatsapp ------------
// Info a record by ID & Sending a record by Narahubung
function sendInfoRecord(id) {
  // Periksa apakah ID valid sebelum melanjutkan
  // if (!isValidId(id)) {
  //     Logger.log("ID tidak valid:", id);
  //     return;
  // }

  const orm = new ORM();
  const existingRecord = orm.readById(id);

  if (!existingRecord) {
    // Logger.log("Record not found for ID:", id);
    return;
  }

  // Logger.log("Existing Record:", existingRecord); // Tambahkan log ini untuk memeriksa data

  const phoneNumber = existingRecord["nomorNarahubung"];
  const narahubung = existingRecord["namaNarahubung"];
  const plat = existingRecord["plat"];
  const masaPajak = existingRecord["tanggalMasaPajak"];
  const masaStnk = existingRecord["tanggalMasaSTNK"];
  const biaya = existingRecord["biaya"];
  const gantiPlat = existingRecord["approval"];
  const keadaan = existingRecord["priority"];

  // Function to format date to dd/mm/yyyy
  const formatDate = (date) => {
    if (date instanceof Date) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return date.toString();
  };

  const masaPajakString = formatDate(masaPajak);
  const masaStnkString = formatDate(masaStnk);

  // Mengubah biaya menjadi format Rupiah
  const biayaRupiah =
    biaya && biaya !== ""
      ? biaya.toLocaleString("id-ID", { style: "currency", currency: "IDR" })
      : "-";

  // Mengubah gantiPlat menjadi format Yes/No
  const gantiPlatString = gantiPlat === "Yes" ? "Ya" : "Tidak";

  const serverUrl =
    "https://serverdinkes.pegasus-kokanue.ts.net/message/sendText/DINKES";
  const apiKey = "apikey";

  const message = `
*Info Masa Pajak Kendaraan Dinas Kesehatan*

Hi, ${narahubung}

Kami ingin mengingatkan bahwa plat kendaraan Dinas Kesehatan tertera dibawah akan memasuki masa pembayaran pajak dalam waktu kurang dari 1 minggu. Mohon untuk menyiapkan kelengkapan dokumen untuk pembayaran pajak.

Detail Kendaraan:
- Nomor Plat: *${plat}*
- Tanggal Masa Pajak: ${masaPajakString}
- Tanggal Masa STNK: ${masaStnkString}
- Pergantian Plat: ${gantiPlatString}
- Keadaan: ${keadaan}
- Biaya: ${biayaRupiah} 

Silakan kunjungi tautan berikut untuk membuat surat pengantar dan mendatangi Dinas Kesehatan untuk verifikasi dan melakukan pembayaran:
https://chatgpt.com/

Harap diperhatikan bahwa biaya dalam info ini hanya rujukan dari aplikasi SIMPATOR Milik Pemerintah Provinsi Kalimantan Timur.

Terima kasih atas perhatian Anda.`;

  const body = {
    number: phoneNumber.toString(),
    text: message,
    delay: 0, // Menambahkan delay jika diperlukan
  };

  // Logger.log("Request body:", JSON.stringify(body)); // Log request body

  const options = {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(body), // Menggunakan payload sesuai format yang diberikan
    muteHttpExceptions: true, // Tambahkan ini untuk menangkap respons kesalahan
  };

  let response; // Declare response outside the try block
  let success = false; // Variable to track success
  // Logger.log("Sending request to server with body:", JSON.stringify(body)); // Log the request body

  try {
    response = UrlFetchApp.fetch(serverUrl, options);

    const jsonResponse = JSON.parse(response.getContentText());
    // Logger.log("Parsed JSON response:", jsonResponse);
  } catch (err) {
    // Logger.log("Error during sendInfoRecord:", err.message); // Log error message
    // Logger.log("Error details:", err); // Log the entire error object for more details
    if (response) {
      // Logger.log("Response code:", response.getResponseCode()); // Log the response code if available
      // Logger.log("Response content:", response.getContentText()); // Log the response content
    } else {
      // Logger.log("No response received."); // Log if response is undefined
    }
  }
}

// ----------Testing All ID ------------
// function getAllIds() {
//     const orm = new ORM();
//     const dataRange = orm.sheet.getDataRange();
//     const values = dataRange.getValues();

//     // Ambil ID dari kolom pertama (indeks 0)
//     const ids = values.slice(1).map(row => row[0]); // Mengambil ID dari kolom pertama

//     return ids;
// }

// function isValidId(id) {
//     const ids = getAllIds(); // Ambil semua ID
//     return ids.includes(id); // Periksa apakah ID ada dalam daftar
// }

// function testSendInfoRecord() {
//     const testId = 517; // Ganti dengan ID yang valid untuk pengujian
//     if (isValidId(testId)) {
//         sendInfoRecord(testId);
//     } else {
//         Logger.log("ID tidak valid:", testId);
//     }
// }

// // Test function
// function testStartScraping() {
//     const testId = 515; // Replace with a valid ID for testing
//     startScraping(testId);
// }

// function debugAppPrefs() {
//   const apps = getAppPrefs();
//   console.log(apps);
//   return apps;
// }
