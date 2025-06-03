import React, { useState, useEffect } from "react";
import { FaFileExcel, FaFileCsv, FaFileAlt, FaChartPie, FaUsers, FaBox, FaTags, FaBuilding, FaWarehouse, FaFileDownload, FaSyncAlt, FaFileInvoice } from "react-icons/fa";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, LineChart, Line, } from "recharts";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import axios from "axios";
import { parse, isValid, format } from "date-fns";

const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSy0p8wdQ3l5656meByE6qLxZK-IPD5po164cIRb37n_jLKwOMg4-28AlPZOnjNjA/pub?gid=1331183736&single=true&output=csv";

const App = () => {
  const [excelData, setExcelData] = useState(null);
  const [googleSheetData, setGoogleSheetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState("Summary");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fileName, setFileName] = useState("");
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [googleSheetDateRange, setGoogleSheetDateRange] = useState({ start: null, end: null });
  const [dataSource, setDataSource] = useState("file");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const storedExcelData = localStorage.getItem("excelData");

    if (storedExcelData) {
      const parsedData = JSON.parse(storedExcelData);
      setExcelData(parsedData.data);
      setFileName(parsedData.fileName || "Unknown File");
      setDateRange({
        start: parsedData.dateRange?.start ? new Date(parsedData.dateRange.start) : null,
        end: parsedData.dateRange?.end ? new Date(parsedData.dateRange.end) : null,
      });
      setDataSource("file");
    }

    fetchGoogleSheetData();
  }, []);

  const fetchGoogleSheetData = async () => {
    setLoading(true);
    setError(null);
    setDataSource("google-sheet");

    try {
      const response = await axios.get(GOOGLE_SHEET_CSV_URL);
      const csvText = response.data;
      console.log("CSV Data:", csvText);

      const parsedData = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      console.log("Parsed Data:", parsedData.data);

      if (!parsedData.data || parsedData.data.length === 0) {
        throw new Error("No data found in Google Sheet");
      }

      const mappedData = mapGoogleSheetData(parsedData.data);
      console.log("Mapped Data:", mappedData);

      const requiredColumns = [
        "memberLocalName",
        "memberId",
        "totalAmount",
        "orderCount",
        "productName",
        "productCode",
        "branchTransactionCode",
        "branchReceiveCode",
        "purchaseDate",
        "purchaseCode",
        "purchaseChannel",
        "purchaseType",
        "totalThisPrice",
      ];
      const headers = Object.keys(mappedData[0]);
      const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
      if (missingColumns.length > 0) {
        throw new Error(`Missing columns: ${missingColumns.join(", ")}`);
      }

      const cleanedData = processGoogleSheetData(mappedData);
      console.log("Cleaned Data:", cleanedData);

      const purchaseDates = mappedData
        .map((row) => parse(row["purchaseDate"], "M/d/yyyy HH:mm", new Date())) // ปรับรูปแบบวันที่ให้ตรงกับ "6/1/2025 23:21"
        .filter((date) => isValid(date));
      const start = purchaseDates.length > 0 ? new Date(Math.min(...purchaseDates)) : null;
      const end = purchaseDates.length > 0 ? new Date(Math.max(...purchaseDates)) : null;
      setGoogleSheetDateRange({ start, end });

      setGoogleSheetData(cleanedData);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      console.error("Fetch Error:", err);
      setError(`Error fetching Google Sheet: ${err.message}`);
      setLoading(false);
    }
  };

  const mapGoogleSheetData = (rows) => {
    return rows.map((row) => ({
      memberLocalName: row["CustomerName"] || "Unknown", // ยังไม่มีในข้อมูล อาจต้องเพิ่มใน Google Sheet
      memberId: row["MemberID"] || "N/A", // ยังไม่มีในข้อมูล อาจต้องเพิ่มใน Google Sheet
      totalAmount: parseFloat(row["Total Sales (All)"]) || 0, // ใช้ Total Sales (All) เป็นตัวแทนยอดขายรวม
      orderCount: parseInt(row["Total Sales (All)"]) || 0, // ใช้ Total Sales (All) เป็นจำนวนการขาย
      productName: row["Product Name"] || "Unknown",
      productCode: row["SKU"] || "N/A",
      branchTransactionCode: row["Branch"] || "N/A",
      branchReceiveCode: row["BranchReceive"] || "N/A", // ยังไม่มีในข้อมูล อาจต้องเพิ่มใน Google Sheet
      purchaseDate: row["date"] || "N/A",
      purchaseCode: row["PurchaseCode"] || "N/A", // ยังไม่มีในข้อมูล อาจต้องเพิ่มใน Google Sheet
      purchaseChannel: row["PurchaseChannel"] || "N/A", // ยังไม่มีในข้อมูล อาจต้องเพิ่มใน Google Sheet
      purchaseType: row["PurchaseType"] || "Unknown", // ยังไม่มีในข้อมูล อาจต้องเพิ่มใน Google Sheet
      totalThisPrice: parseFloat(row["Total Price (All)"]) || 0,
    }));
  };

  const processGoogleSheetData = (rawData) => {
    const quantityByProduct = {};

    rawData.forEach((row) => {
      if (!row["productName"] || row["productName"] === "Unknown") return;

      const product = row["productName"];
      const quantity = parseInt(row["orderCount"]) || 0;
      const totalPrice = parseFloat(row["totalThisPrice"]) || 0;
      const date = row["purchaseDate"];
      const productCode = row["productCode"] || "N/A";

      if (quantity > 0) {
        quantityByProduct[product] = quantityByProduct[product] || {
          quantity: 0,
          totalPrice: 0,
          date,
          productId: productCode,
        };
        quantityByProduct[product].quantity += quantity;
        quantityByProduct[product].totalPrice += totalPrice;
      }
    });

    return { quantityByProduct };
  };

  const menuItems = [
    "Summary",
    "Sales by Customer",
    "Quantity Sold by Product",
    "Products Promotion",
    "Sales by Branch",
    "Sales by Stockiest Branch",
    "Google Sheets Data",
  ];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setDataSource("file");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rawData;
        const fileExtension = file.name.split(".").pop().toLowerCase();

        if (fileExtension === "csv") {
          const text = e.target.result;
          rawData = parseCSV(text);
        } else if (["xlsx", "xls"].includes(fileExtension)) {
          const workbook = XLSX.read(e.target.result, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        } else {
          throw new Error("Unsupported file format: Please use .xlsx, .xls, or .csv");
        }

        const headers = rawData[0].map((h) => (h ? h.toString().trim().replace(/^"|"$/g, "") : ""));
        const requiredColumns = [
          "memberLocalName",
          "memberId",
          "totalAmount",
          "orderCount",
          "productName",
          "productCode",
          "branchTransactionCode",
          "branchReceiveCode",
          "purchaseDate",
          "purchaseCode",
          "purchaseChannel",
          "purchaseType",
          "totalThisPrice",
        ];
        const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
        if (missingColumns.length > 0) {
          throw new Error("Missing columns: " + missingColumns.join(", "));
        }

        const dataRows = rawData.slice(1).map((row) =>
          row.reduce((obj, val, i) => {
            obj[headers[i]] = val ? val.toString().trim().replace(/^"|"$/g, "") : "";
            return obj;
          }, {})
        );

        const cleanedData = processAndCleanData(dataRows);

        const purchaseDates = dataRows
          .map((row) => row["purchaseDate"])
          .filter((date) => date && date !== "N/A" && !isNaN(new Date(date).getTime()))
          .map((date) => new Date(date));
        const validDates = purchaseDates.filter((date) => !isNaN(date.getTime()));
        const start = validDates.length > 0 ? new Date(Math.min(...validDates)) : null;
        const end = validDates.length > 0 ? new Date(Math.max(...validDates)) : null;
        setDateRange({ start, end });

        setExcelData(cleanedData);
        localStorage.setItem(
          "excelData",
          JSON.stringify({
            data: cleanedData,
            fileName: file.name,
            dateRange: { start, end },
            source: "file",
          })
        );
        setLoading(false);
      } catch (err) {
        console.error("Error processing file:", err);
        setError("Error: " + err.message);
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Error reading file");
      setLoading(false);
    };

    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const clearLocalStorage = () => {
    localStorage.removeItem("excelData");
    setExcelData(null);
    setGoogleSheetData(null);
    setError(null);
    setLoading(false);
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setFileName("");
    setDateRange({ start: null, end: null });
    setGoogleSheetDateRange({ start: null, end: null });
    setDataSource("file");
    setLastUpdated(null);
    fetchGoogleSheetData();
  };

  const parseCSV = (csvText) => {
    const rows = csvText.split(/\r?\n/);
    return rows.map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  };

  const processAndCleanData = (rawData) => {
    const salesByCustomer = {};
    const quantityByProduct = {};
    const salesByBranch = {};
    const salesByBranchDaily = {};
    const quantityPProducts = {};
    let totalQuantityPProducts = 0;
    const purchaseCodes = new Set();
    const nonStockiestPurchaseCodes = new Set();
    const purchaseTypeBreakdown = {};

    rawData.forEach((row) => {
      if (!row["memberLocalName"] || !row["branchTransactionCode"] || !row["purchaseCode"]) return;

      const totalAmount = parseFloat(row["totalAmount"]) || 0;
      const totalThisPrice = parseFloat(row["totalThisPrice"]) || 0;
      const orderCount = parseInt(row["orderCount"]) || 0;
      const customer = row["memberLocalName"];
      const memberId = row["memberId"] || "N/A";
      const product = row["productName"] || "Unknown";
      const branch = row["branchTransactionCode"];
      const branchReceive = row["branchReceiveCode"] || "N/A";
      const productCode = row["productCode"] || "N/A";
      const purchaseDate = row["purchaseDate"] || "N/A";
      const purchaseCode = row["purchaseCode"];
      const purchaseChannel = row["purchaseChannel"] || "N/A";
      const purchaseType = row["purchaseType"] || "Unknown";

      purchaseCodes.add(purchaseCode);
      if (!purchaseChannel.startsWith("STOCKIEST")) {
        nonStockiestPurchaseCodes.add(purchaseCode);
        purchaseTypeBreakdown[purchaseType] = purchaseTypeBreakdown[purchaseType] || new Set();
        purchaseTypeBreakdown[purchaseType].add(purchaseCode);
      }

      if (totalAmount > 0 && !purchaseChannel.startsWith("STOCKIEST")) {
        salesByCustomer[customer] = salesByCustomer[customer] || { amount: 0, date: purchaseDate, memberIds: new Set() };
        salesByCustomer[customer].amount += totalAmount;
        if (memberId !== "N/A") salesByCustomer[customer].memberIds.add(memberId);
      }

      if (orderCount > 0 && product !== "Unknown" && !productCode.startsWith("P") && !branchReceive.startsWith("KS")) {
        quantityByProduct[product] = quantityByProduct[product] || { quantity: 0, totalPrice: 0, date: purchaseDate, productId: productCode };
        quantityByProduct[product].quantity += orderCount;
        quantityByProduct[product].totalPrice += totalThisPrice;
      }

      if (totalAmount > 0) {
        salesByBranch[branch] = salesByBranch[branch] || { amount: 0, date: purchaseDate };
        salesByBranch[branch].amount += totalAmount;

        if (purchaseDate !== "N/A" && !isNaN(new Date(purchaseDate).getTime())) {
          const dateKey = new Date(purchaseDate).toISOString().split("T")[0];
          salesByBranchDaily[branch] = salesByBranchDaily[branch] || {};
          salesByBranchDaily[branch][dateKey] = (salesByBranchDaily[branch][dateKey] || 0) + totalAmount;
        }
      }

      if (orderCount > 0 && productCode.startsWith("P")) {
        quantityPProducts[product] = quantityPProducts[product] || { quantity: 0, totalPrice: 0, date: purchaseDate, productId: productCode };
        quantityPProducts[product].quantity += orderCount;
        quantityPProducts[product].totalPrice += totalThisPrice;
        totalQuantityPProducts += orderCount;
      }
    });

    const dailySalesData = [];
    const allDates = new Set();
    Object.values(salesByBranchDaily).forEach((branchData) => {
      Object.keys(branchData).forEach((date) => allDates.add(date));
    });
    const sortedDates = Array.from(allDates).sort();

    sortedDates.forEach((date) => {
      const entry = { date };
      Object.keys(salesByBranchDaily).forEach((branch) => {
        entry[branch] = salesByBranchDaily[branch][date] || 0;
      });
      dailySalesData.push(entry);
    });

    const purchaseTypeCounts = {};
    Object.entries(purchaseTypeBreakdown).forEach(([type, codes]) => {
      purchaseTypeCounts[type] = codes.size;
    });

    return {
      salesByCustomer,
      quantityByProduct,
      salesByBranch,
      salesByBranchDaily: dailySalesData,
      totalQuantityPProducts,
      quantityPProducts,
      purchaseCount: purchaseCodes.size,
      nonStockiestPurchaseCount: nonStockiestPurchaseCodes.size,
      purchaseTypeCounts,
    };
  };

  const filterByDate = (dataArray, start, end) => {
    if (!start || !end || !dataArray) return dataArray || [];
    return dataArray.filter((item) => {
      const itemDate = new Date(item.date);
      const startDate = new Date(start);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      return itemDate >= startDate && itemDate <= endDate;
    });
  };

  const filterBySearch = (dataArray, query) => {
    if (!query || !dataArray) return dataArray || [];
    const searchField = dataArray[0]?.branch ? "branch" : "name";
    return dataArray.filter((item) => item[searchField].toLowerCase().includes(query.toLowerCase()));
  };

  const formatDateRange = (range) => {
    if (!range.start || !range.end || isNaN(range.start.getTime()) || isNaN(range.end.getTime())) {
      return "N/A";
    }
    const start = range.start.toLocaleDateString("en-GB");
    const end = range.end.toLocaleDateString("en-GB");
    return `${start} - ${end}`;
  };

  const formatLastUpdated = (date) => {
    if (!date) return "Never";
    return format(date, "dd/MM/yyyy HH:mm");
  };

  if (!excelData && !googleSheetData) {
    return (
      <div className="flex">
        <div className="sidebar relative">
          <img src="/SCM-Logo.png" width={170} alt="logo" className="mb-5 pl-3" />
          <ul>
            {menuItems.map((menu) => (
              <li
                key={menu}
                className={selectedMenu === menu ? "active items-center flex" : "items-center flex"}
                onClick={() => setSelectedMenu(menu)}
              >
                {menu === "Summary" && <FaChartPie size={20} className="inline mr-2" />}
                {menu === "Sales by Customer" && <FaUsers size={20} className="inline mr-2" />}
                {menu === "Quantity Sold by Product" && <FaBox size={20} className="inline mr-2" />}
                {menu === "Products Promotion" && <FaTags size={20} className="inline mr-2" />}
                {menu === "Sales by Branch" && <FaBuilding size={20} className="inline mr-2" />}
                {menu === "Sales by Stockiest Branch" && <FaWarehouse size={20} className="inline mr-2" />}
                {menu === "Google Sheets Data" && <FaFileDownload size={20} className="inline mr-2" />}
                {menu}
              </li>
            ))}
          </ul>
          <div className="absolute px-2 bottom-2 w-full">
            <p className="w-full py-4 px-4 border rounded-md text-gray-700 bg-gray-50 border-gray-200 font-light">
              © Copyright by <span className="font-semibold">RON PHEAROM</span>
            </p>
          </div>
        </div>
        <div className="content flex-1">
          <div className="flex justify-center items-center h-[70vh]">
            <div className="animate-spin rounded-full h-20 w-20 border-8 border-t-red-700 border-gray-200"></div>
          </div>
        </div>

        {/* <div className="content flex-1">
          <div className="header bg-gradient-to-r from-green-700 to-green-500 text-white p-6 rounded-t-lg text-center">
            <h1 className="text-4xl font-semibold">Sales Report</h1>
          </div>
          <div className="upload-section bg-white p-6 rounded-b-lg shadow-lg mb-8 text-center border border-gray-300">
            <h2 className="text-2xl font-semibold text-green-700 mb-4">
              Upload File to View Report
            </h2>
            <div className="flex justify-between items-center border-2 p-10 rounded-md border-dotted border-gray-500">
              <label className="flex justify-center items-center gap-1 hover:cursor-pointer">
                <FaFileExcel size={36} className="text-green-700" />
                <p className="font-kantumruy text-xl border border-green-700 py-1 px-3 transition-all duration-200 rounded hover:bg-green-700 tra hover:text-white text-green-700 font-medium">
                  ចុចត្រង់នេះដើម្បី Upload File
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="upload-btn px-4 hidden py-2 2/12 border border-green-700 rounded text-green-700 cursor-pointer hover:text-white"
                  onChange={handleFileUpload}
                />
              </label>
              <div className="flex justify-center items-center gap-2 text-gray-600">
                <FaFileCsv size={25} />
                <FaFileExcel size={25} />
                <FaFileAlt size={25} />
                <p>Support File: .xlsx, .xls, .csv</p>
              </div>
            </div>
            {error && <p className="error text-red-600 text-lg mt-4">{error}</p>}
            {loading && <p className="loading text-lg mt-4">Loading Google Sheet data...</p>}
          </div>
          <div className="border border-gray-300 shadow-md rounded-xl">
            <img src="/how_to_upoad_file-01.png" alt="" className="object-cover" />
          </div>
        </div> */}

      </div>
    );
  }

  const data = selectedMenu === "Google Sheets Data" ? googleSheetData : excelData;
  const currentDateRange = selectedMenu === "Google Sheets Data" ? googleSheetDateRange : dateRange;

  const customerData = data && data.salesByCustomer
    ? Object.entries(data.salesByCustomer)
      .map(([name, { amount, date, memberIds }]) => {
        const memberIdArray = Array.from(memberIds);
        let memberId = "N/A";
        let stockiestId = "N/A";

        memberIdArray.forEach((id) => {
          if (/[A-Za-z]/.test(id) && stockiestId === "N/A") {
            stockiestId = id;
          } else if (!/[A-Za-z]/.test(id) && memberId === "N/A") {
            memberId = id;
          }
        });

        return { name, amount, date, memberId, stockiestId };
      })
      .sort((a, b) => b.amount - a.amount)
    : [];

  const productData = data && data.quantityByProduct
    ? Object.entries(data.quantityByProduct)
      .map(([name, { quantity, totalPrice, date, productId }]) => ({
        name,
        quantity,
        totalPrice: totalPrice.toFixed(2),
        date,
        productId,
      }))
      .sort((a, b) => b.quantity - a.quantity)
    : [];

  const pProductData = data && data.quantityPProducts
    ? Object.entries(data.quantityPProducts)
      .map(([name, { quantity, totalPrice, date, productId }]) => ({
        name,
        quantity,
        totalPrice: totalPrice.toFixed(2),
        date,
        productId,
      }))
      .sort((a, b) => b.quantity - a.quantity)
    : [];

  const branchData = data && data.salesByBranch
    ? Object.entries(data.salesByBranch)
      .map(([branch, { amount, date }]) => ({ branch, amount, date }))
      .sort((a, b) => b.amount - a.amount)
    : [];

  const customerTop10 = filterByDate(filterBySearch(customerData, searchQuery), startDate, endDate).slice(0, 10);
  const productTop10 = filterByDate(filterBySearch(productData, searchQuery), startDate, endDate).slice(0, 10);
  const pProductTop10 = filterByDate(filterBySearch(pProductData, searchQuery), startDate, endDate).slice(0, 10);
  const googleSheetProductTop10 = filterByDate(filterBySearch(productData, searchQuery), startDate, endDate).slice(0, 10);
  const branchTop10 = filterByDate(
    filterBySearch(
      branchData.filter((item) => item.branch.startsWith("PNH01") || item.branch.startsWith("KCM01")),
      searchQuery
    ),
    startDate,
    endDate
  ).slice(0, 10);
  const stockiestBranchTop10 = filterByDate(
    filterBySearch(branchData.filter((item) => item.branch.startsWith("KS")), searchQuery),
    startDate,
    endDate
  ).slice(0, 10);

  const customerAll = filterByDate(filterBySearch(customerData, searchQuery), startDate, endDate);
  const productAll = filterByDate(filterBySearch(productData, searchQuery), startDate, endDate);
  const pProductAll = filterByDate(filterBySearch(pProductData, searchQuery), startDate, endDate);
  const googleSheetProductAll = filterByDate(filterBySearch(productData, searchQuery), startDate, endDate);
  const branchAll = filterByDate(
    filterBySearch(
      branchData.filter((item) => item.branch.startsWith("PNH01") || item.branch.startsWith("KCM01")),
      searchQuery
    ),
    startDate,
    endDate
  );
  const stockiestBranchAll = filterByDate(
    filterBySearch(branchData.filter((item) => item.branch.startsWith("KS")), searchQuery),
    startDate,
    endDate
  );

  const totalSales = data && data.salesByCustomer
    ? Object.values(data.salesByCustomer)
      .reduce((sum, val) => sum + val.amount, 0)
      .toFixed(2)
    : "0.00";
  const topProduct = data && productData.length > 0 ? productData[0] : { name: "N/A", quantity: 0 };

  const summaryData = {
    "Sales by Customer": {
      total: customerAll.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      count: customerAll.length,
      icon: <FaUsers size={30} className="text-blue-600" />,
      bgColor: "bg-blue-100",
    },
    "Quantity Sold by Product": {
      total: productAll.reduce((sum, item) => sum + item.quantity, 0),
      count: productAll.length,
      icon: <FaBox size={30} className="text-green-600" />,
      bgColor: "bg-green-100",
    },
    "Products Promotion": {
      total: pProductAll.reduce((sum, item) => sum + item.quantity, 0),
      count: pProductAll.length,
      icon: <FaTags size={30} className="text-orange-600" />,
      bgColor: "bg-orange-100",
    },
    "Sales by Branch": {
      total: branchAll.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      count: branchAll.length,
      icon: <FaBuilding size={30} className="text-purple-600" />,
      bgColor: "bg-purple-100",
    },
    "Sales by Stockiest Branch": {
      total: stockiestBranchAll.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      count: stockiestBranchAll.length,
      icon: <FaWarehouse size={30} className="text-teal-600" />,
      bgColor: "bg-teal-100",
    },
    "Total Purchase Bills": {
      total: data?.nonStockiestPurchaseCount || 0,
      purchaseTypeCounts: data?.purchaseTypeCounts || {},
      icon: <FaFileInvoice size={30} className="text-yellow-600" />,
      bgColor: "bg-yellow-100",
    },
    // "Google Sheets Data": {
    //   total: googleSheetProductAll.reduce((sum, item) => sum + item.quantity, 0),
    //   count: googleSheetProductAll.length,
    //   icon: <FaFileDownload size={30} className="text-indigo-600" />,
    //   bgColor: "bg-indigo-100",
    // },
  };

  const renderContent = () => {
    let filteredDataGraph = [];
    let filteredDataTable = [];
    switch (selectedMenu) {
      case "Summary":
        return (
          <div className="summary-section bg-white p-6 rounded-lg shadow-lg border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">Summary</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {Object.entries(summaryData).map(([menu, { total, count, purchaseTypeCounts, icon, bgColor }]) => (
                <div
                  key={menu}
                  className={`p-6 rounded-lg shadow-md ${bgColor} flex items-center space-x-4 transform transition-transform hover:scale-105 hover:shadow-lg`}
                >
                  <div>{icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{menu}</h3>
                    {menu === "Total Purchase Bills" ? (
                      <div>
                        <p className="text-gray-600">Total Non-Stockiest Bills: {total}</p>
                        <div className="flex justify-between">
                          {Object.entries(purchaseTypeCounts)
                            .slice(0, 3)
                            .map(([type, count]) => (
                              <div key={type} className="text-gray-600 gap-2 px-2">
                                {type}: {count}
                              </div>
                            ))}
                          {Object.keys(purchaseTypeCounts).length > 3 && (
                            <p className="text-gray-600">And more...</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-600">
                          {menu.includes("Sales") ? `Total Sales: $ ${total} USD` : `Total Quantity: ${total} ${menu === "Products Promotion" ? "Sets" : "units"}`}
                        </p>
                        <p className="text-gray-600">
                          {menu === "Sales by Customer"
                            ? "Member Counts :"
                            : menu === "Quantity Sold by Product"
                              ? "Product Items :"
                              : menu === "Products Promotion"
                                ? "Product Codes :"
                                : menu === "Sales by Branch"
                                  ? "Branch :"
                                  : menu === "Sales by Stockiest Branch"
                                    ? "Stockiests :"
                                    : "Items :"}{" "}
                          {count}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "Sales by Customer":
        filteredDataGraph = customerTop10;
        filteredDataTable = customerAll;
        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">Sales by Customer: Top 10</h2>
              <div>
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-2 border rounded"
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={filteredDataGraph}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={12} />
                <YAxis
                  label={{ value: "Sales (USD)", angle: -90, position: "insideLeft", fontSize: 12 }}
                  fontSize={12}
                />
                <Tooltip formatter={(value) => `$ ${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="amount" fill="#3B82F6" name="Sales" />
              </BarChart>
            </ResponsiveContainer>
            {customerData.length > 0 && (
              <div>
                <div className="scroll-table">
                  <table>
                    <thead className="customer">
                      <tr>
                        <th>Member ID</th>
                        <th>Stockiest ID</th>
                        <th>Customer</th>
                        <th>Sales (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataTable.map((item) => (
                        <tr key={item.name}>
                          <td>{item.memberId}</td>
                          <td>{item.stockiestId}</td>
                          <td>{item.name}</td>
                          <td>{item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 font-semibold text-xl">Member Total: {filteredDataTable.length} ID</p>
              </div>
            )}
          </div>
        );
      case "Quantity Sold by Product":
        filteredDataGraph = productTop10;
        filteredDataTable = productAll;
        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">
                Quantity Sold by Product: Top 10 <span className="text-red-600">(Not including promotions)</span>
              </h2>
              <div>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-2 border rounded"
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={filteredDataGraph}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={12} />
                <YAxis
                  label={{ value: "Quantity", angle: -90, position: "insideLeft", fontSize: 12 }}
                  fontSize={12}
                />
                <Tooltip formatter={(value) => (typeof value === "number" ? value : parseInt(value) || 0)} />
                <Legend />
                <Bar dataKey="quantity" fill="#10B981" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
            {productData.length > 0 && (
              <div>
                <div className="scroll-table">
                  <table>
                    <thead className="sold-product">
                      <tr>
                        <th>Product ID</th>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Total Price (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataTable.map((item) => (
                        <tr key={item.name}>
                          <td>{item.productId}</td>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>{item.totalPrice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 font-semibold text-xl">Products Items: {filteredDataTable.length} Items</p>
              </div>
            )}
          </div>
        );
      case "Products Promotion":
        filteredDataGraph = pProductTop10;
        filteredDataTable = pProductAll;
        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">Quantity of Products Promotion Top 10</h2>
              <div>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-2 border rounded"
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={filteredDataGraph}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={12} />
                <YAxis
                  label={{ value: "Quantity", angle: -90, position: "insideLeft", fontSize: 12 }}
                  fontSize={12}
                />
                <Tooltip formatter={(value) => (typeof value === "number" ? value : parseInt(value) || 0)} />
                <Legend />
                <Bar dataKey="quantity" fill="#F97316" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
            {pProductData.length > 0 && (
              <div>
                <div className="scroll-table">
                  <table>
                    <thead className="promotion">
                      <tr>
                        <th>Product ID</th>
                        <th>Product</th>
                        <th>Sets</th>
                        <th>Total Price (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataTable.map((item) => (
                        <tr key={item.name}>
                          <td>{item.productId}</td>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>{item.totalPrice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 font-semibold text-xl">Promotion Items: {filteredDataTable.length} Items</p>
              </div>
            )}
          </div>
        );
      case "Sales by Branch":
        filteredDataGraph = data?.salesByBranchDaily || [];
        filteredDataTable = branchAll;

        const filteredGraphData = filterByDate(
          filterBySearch(
            filteredDataGraph.map((item) => {
              const filteredItem = { date: item.date };
              Object.keys(item).forEach((key) => {
                if (key !== "date" && (key.startsWith("PNH01") || key.startsWith("KCM01"))) {
                  filteredItem[key] = item[key];
                }
              });
              return filteredItem;
            }),
            searchQuery
          ),
          startDate,
          endDate
        );

        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">Daily Sales Trend by Branch</h2>
              <div>
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-2 border rounded"
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={filteredGraphData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis
                  label={{
                    value: "Sales (USD)",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                  }}
                  fontSize={12}
                />
                <Tooltip formatter={(value) => `$ ${value.toFixed(2)}`} />
                <Legend />
                {Object.keys(filteredGraphData[0] || {})
                  .filter((key) => key !== "date")
                  .map((branch, index) => (
                    <Line
                      key={branch}
                      type="monotone"
                      dataKey={branch}
                      stroke={["#8B5CF6", "#10B981", "#F97316", "#3B82F6"][index % 4]}
                      strokeWidth={2}
                      name={branch}
                      dot={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
            {branchData.length > 0 && (
              <div className="scroll-table">
                <table>
                  <thead className="branch">
                    <tr>
                      <th>Branch</th>
                      <th>Sales (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDataTable.map((item) => (
                      <tr key={item.branch}>
                        <td>{item.branch}</td>
                        <td>{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case "Sales by Stockiest Branch":
        filteredDataGraph = stockiestBranchTop10;
        filteredDataTable = stockiestBranchAll;
        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">Sales by Stockiest Branch</h2>
              <div>
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-2 border rounded"
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={filteredDataGraph}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branch" fontSize={12} />
                <YAxis
                  label={{ value: "Sales (USD)", angle: -90, position: "insideLeft", fontSize: 12 }}
                  fontSize={12}
                />
                <Tooltip formatter={(value) => `$ ${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="amount" fill="#8B5CF6" name="Sales" />
              </BarChart>
            </ResponsiveContainer>
            {branchData.length > 0 && (
              <div className="scroll-table">
                <table>
                  <thead className="stockiest">
                    <tr>
                      <th>Branch</th>
                      <th>Sales (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDataTable.map((item) => (
                      <tr key={item.branch}>
                        <td>{item.branch}</td>
                        <td>{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case "Google Sheets Data":
        filteredDataGraph = googleSheetProductTop10;
        filteredDataTable = googleSheetProductAll;
        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">All Quantity <span className="text-green-800">(includes promotions)</span></h2>
              <div className="flex items-center gap-4">
                <p className="text-gray-600">Date Range: <span className="font-semibold">{formatDateRange(googleSheetDateRange)}</span></p>
                {/* <p className="text-gray-600">Last Updated: <span className="font-semibold">{formatLastUpdated(lastUpdated)}</span></p> */}
                <button
                  onClick={fetchGoogleSheetData}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  <FaSyncAlt size={16} />
                  Refresh Data
                </button>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-2 border rounded"
                />
              </div>
            </div>
            {filteredDataGraph.length === 0 ? (
              <p className="text-center text-gray-600">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filteredDataGraph}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={12} />
                  <YAxis
                    label={{ value: "Quantity", angle: -90, position: "insideLeft", fontSize: 12 }}
                    fontSize={12}
                  />
                  <Tooltip formatter={(value) => (typeof value === "number" ? value : parseInt(value) || 0)} />
                  <Legend />
                  <Bar dataKey="quantity" fill="#4B0082" name="Quantity" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {googleSheetProductAll.length > 0 && (
              <div>
                <div className="scroll-table">
                  <table>
                    <thead className="google-sheet">
                      <tr>
                        <th>Product ID</th>
                        <th>Product</th>
                        <th>Quantity</th>
                        {/* <th>Total Price (USD)</th>
                        <th>Total Price (All)</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataTable.map((item) => (
                        <tr key={item.name}>
                          <td>{item.productId}</td>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          {/* <td>{item.totalPrice}</td>
                          <td>{item.totalPrice}</td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 font-semibold text-xl">Product Items: {filteredDataTable.length} Items</p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex">
      <div className="sidebar relative">
        <img src="/SCM-Logo.png" width={170} alt="logo" className="mb-5 pl-3" />
        <ul>
          {menuItems.map((menu) => (
            <li
              key={menu}
              className={selectedMenu === menu ? "active items-center flex" : "items-center flex"}
              onClick={() => setSelectedMenu(menu)}
            >
              {menu === "Summary" && <FaChartPie size={20} className="inline mr-2" />}
              {menu === "Sales by Customer" && <FaUsers size={20} className="inline mr-2" />}
              {menu === "Quantity Sold by Product" && <FaBox size={20} className="inline mr-2" />}
              {menu === "Products Promotion" && <FaTags size={20} className="inline mr-2" />}
              {menu === "Sales by Branch" && <FaBuilding size={20} className="inline mr-2" />}
              {menu === "Sales by Stockiest Branch" && <FaWarehouse size={20} className="inline mr-2" />}
              {menu === "Google Sheets Data" && <FaFileDownload size={20} className="inline mr-2" />}
              {menu}
            </li>
          ))}
        </ul>
        <div className="absolute px-2 bottom-2 w-full">
          <p className="w-full py-4 px-4 border rounded-md text-gray-700 bg-gray-50 border-gray-200 font-light">
            © Copyright by <span className="font-semibold">RON PHEAROM</span>
          </p>
        </div>
      </div>
      <div className="content flex-1">
        <div className="upload-section bg-white p-6 rounded-lg shadow-lg mb-8 text-center justify-between flex gap-4 border border-gray-300">
          <div className="flex gap-2">
            <div className="flex justify-center items-center gap-1">
              <label className="flex justify-center items-center gap-1 hover:cursor-pointer">
                <FaFileExcel size={36} className="text-green-700" />
                <p className="font-kantumruy md:text-[1rem] lg:text-[1.1rem] border border-green-700 py-2 px-3 transition-all duration-200 rounded hover:bg-green-700 tra hover:text-white text-green-700 font-medium">
                  ចុចត្រង់នេះដើម្បី Upload File
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="upload-btn px-4 hidden py-2 border border-green-700 rounded text-green-700 cursor-pointer hover:text-white"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            <button
              onClick={clearLocalStorage}
              className="clear-btn px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
            >
              Clear Data
            </button>
          </div>
          <div className="header bg-gradient-to-r lg:text-[12px] from-green-700 to-green-500 py-2 px-3 text-white rounded flex items-center justify-center">
            <div>
              <div className="flex gap-2">
                {/* <p>
                  Source: <span className="font-semibold">{dataSource === "google-sheet" ? "Google Sheet" : fileName || "N/A"}</span> |{" "}
                </p> */}
                <p>
                  Date Range: <span className="font-semibold">{formatDateRange(currentDateRange)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        {error && <p className="error text-red-600 text-lg mb-4 text-center">{error}</p>}
        {loading && <p className="loading text-lg mb-4 text-center">Loading data...</p>}
        {renderContent()}
      </div>
    </div>
  );
};

export default App;