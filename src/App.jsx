import React, { useState, useEffect } from "react";
import { FaFileExcel, FaFileCsv, FaFileAlt } from "react-icons/fa";
import { FaChartPie, FaUsers, FaBox, FaTags, FaBuilding, FaWarehouse } from "react-icons/fa";
import scm_log from "/SCM-Logo.png"

import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import * as XLSX from "xlsx";

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState("Summary");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fileName, setFileName] = useState("");
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Load data from Local Storage on app start
  useEffect(() => {
    const storedData = localStorage.getItem("salesData");
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      // Convert dateRange strings back to Date objects
      const convertedDateRange = {
        start: parsedData.dateRange?.start
          ? new Date(parsedData.dateRange.start)
          : null,
        end: parsedData.dateRange?.end
          ? new Date(parsedData.dateRange.end)
          : null,
      };
      setData(parsedData.data);
      setFileName(parsedData.fileName || "Unknown File");
      setDateRange(convertedDateRange);
    }
  }, []);

  // Sidebar menu items
  const menuItems = [
    "Summary",
    "Sales by Customer",
    "Quantity Sold by Product",
    "Products Promotion",
    "Sales by Branch",
    "Sales by Stockiest Branch",
  ];

  // Handle Excel and CSV file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFileName(file.name);

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
          throw new Error(
            "Unsupported file format: Please use .xlsx, .xls, or .csv"
          );
        }

        const headers = rawData[0].map((h) =>
          h ? h.toString().trim().replace(/^"|"$/g, "") : ""
        );
        const requiredColumns = [
          "memberLocalName",
          "totalAmount",
          "orderCount",
          "productName",
          "productCode",
          "branchTransactionCode",
          "purchaseDate",
          "purchaseCode",
        ];
        const missingColumns = requiredColumns.filter(
          (col) => !headers.includes(col)
        );
        if (missingColumns.length > 0) {
          throw new Error("Missing columns: " + missingColumns.join(", "));
        }

        const dataRows = rawData.slice(1).map((row) =>
          row.reduce((obj, val, i) => {
            obj[headers[i]] = val
              ? val.toString().trim().replace(/^"|"$/g, "")
              : "";
            return obj;
          }, {})
        );

        const cleanedData = processAndCleanData(dataRows);

        // Calculate date range from purchaseDate
        const purchaseDates = dataRows
          .map((row) => row["purchaseDate"])
          .filter(
            (date) => date && date !== "N/A" && !isNaN(new Date(date).getTime())
          )
          .map((date) => new Date(date));
        const validDates = purchaseDates.filter(
          (date) => !isNaN(date.getTime())
        );
        const start =
          validDates.length > 0 ? new Date(Math.min(...validDates)) : null;
        const end =
          validDates.length > 0 ? new Date(Math.max(...validDates)) : null;
        const newDateRange = { start, end };
        setDateRange(newDateRange);

        setData(cleanedData);
        // Store data in Local Storage
        localStorage.setItem(
          "salesData",
          JSON.stringify({
            data: cleanedData,
            fileName: file.name,
            dateRange: newDateRange,
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

  // Function to clear Local Storage
  const clearLocalStorage = () => {
    localStorage.removeItem("salesData");
    setData(null);
    setError(null);
    setLoading(false);
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setFileName("");
    setDateRange({ start: null, end: null });
  };

  // Parse CSV data
  const parseCSV = (csvText) => {
    const rows = csvText.split(/\r?\n/);
    return rows.map((row) =>
      row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
    );
  };

  // Process and clean data
  const processAndCleanData = (rawData) => {
    const salesByCustomer = {};
    const quantityByProduct = {};
    const salesByBranch = {};
    const quantityPProducts = {};
    let totalQuantityPProducts = 0;
    const purchaseCodes = new Set();

    rawData.forEach((row) => {
      if (
        !row["memberLocalName"] ||
        !row["branchTransactionCode"] ||
        !row["purchaseCode"]
      )
        return;

      const totalAmount = parseFloat(row["totalAmount"]) || 0;
      const orderCount = parseInt(row["orderCount"]) || 0;
      const customer = row["memberLocalName"];
      const product = row["productName"] || "Unknown";
      const branch = row["branchTransactionCode"];
      const productCode = row["productCode"] || "";
      const purchaseDate = row["purchaseDate"] || "N/A";
      const purchaseCode = row["purchaseCode"];

      purchaseCodes.add(purchaseCode);

      if (totalAmount > 0) {
        if (!salesByCustomer[customer])
          salesByCustomer[customer] = { amount: 0, date: purchaseDate };
        salesByCustomer[customer].amount += totalAmount;
      }
      if (orderCount > 0 && product !== "Unknown") {
        if (!quantityByProduct[product])
          quantityByProduct[product] = { quantity: 0, date: purchaseDate };
        quantityByProduct[product].quantity += orderCount;
      }
      if (totalAmount > 0) {
        if (!salesByBranch[branch])
          salesByBranch[branch] = { amount: 0, date: purchaseDate };
        salesByBranch[branch].amount += totalAmount;
      }
      if (orderCount > 0 && productCode.startsWith("P")) {
        if (!quantityPProducts[product])
          quantityPProducts[product] = { quantity: 0, date: purchaseDate };
        quantityPProducts[product].quantity += orderCount;
        totalQuantityPProducts += orderCount;
      }
    });

    return {
      salesByCustomer,
      quantityByProduct,
      salesByBranch,
      totalQuantityPProducts,
      quantityPProducts,
      purchaseCount: purchaseCodes.size,
    };
  };

  // Filter data by date
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

  // Filter data by search query
  const filterBySearch = (dataArray, query) => {
    if (!query || !dataArray) return dataArray || [];
    const searchField = dataArray[0]?.branch ? "branch" : "name";
    return dataArray.filter((item) =>
      item[searchField].toLowerCase().includes(query.toLowerCase())
    );
  };

  // Format date for display
  const formatDateForDisplay = (dateString) => {
    if (dateString === "N/A") return "N/A";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0]; // Display as YYYY-MM-DD
  };

  // Format date range for display
  const formatDateRange = (range) => {
    // Check if range.start and range.end are valid Date objects
    if (
      !range.start ||
      !range.end ||
      !(range.start instanceof Date) ||
      !(range.end instanceof Date) ||
      isNaN(range.start.getTime()) ||
      isNaN(range.end.getTime())
    ) {
      return "N/A";
    }
    const start = range.start.toISOString().split("T")[0];
    const end = range.end.toISOString().split("T")[0];
    return `${start} - ${end}`;
  };

  // If no data, show file upload screen
  if (!data) {
    return (
      <div className="flex">
        {/* Sidebar */}
        <div className="sidebar">
          <img src={scm_log} width={170} alt="logo" className="mb-5 pl-3" />
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
                {menu}
              </li>
            ))}
          </ul>
        </div>
        {/* Content */}
        <div className="content flex-1">
          <div className="header bg-gradient-to-r from-blue-900 to-blue-500 text-white p-6 rounded-t-lg text-center">
            <h1 className="text-4xl font-bold">Sales Report</h1>
            <p className="text-lg mt-2">Report Date: May 25, 2025, 10:17 AM</p>
          </div>
          <div className="upload-section bg-white p-6 rounded-b-lg shadow-lg mb-8 text-center">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">
              Upload File to View Report
            </h2>
            <div className="flex justify-between items-center border-2 p-10 rounded-md  border-dotted border-gray-500">
              <div className="flex justify-center items-center gap-1">
                <FaFileExcel size={35} className="text-green-700" />
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="upload-btn px-4 py-2 2/12 border border-green-700 text-green-700 rounded hover:bg-green-700 cursor-pointer hover:text-white"
                  onChange={handleFileUpload}
                />
              </div>
              <div className="flex justify-center items-center gap-2 text-gray-600">
                <FaFileCsv size={25} />
                <FaFileExcel size={25} /> <FaFileAlt size={25} />
                <p>Support File : .xlsx,.xls,.csv</p>
              </div>
            </div>

            {error && (
              <p className="error text-red-600 text-lg mt-4">{error}</p>
            )}
            {loading && <p className="loading text-lg mt-4">Loading data...</p>}
          </div>
        </div>
      </div>
    );
  }

  // Transform data for charts and tables
  const customerData = data
    ? Object.entries(data.salesByCustomer)
      .map(([name, { amount, date }]) => ({ name, amount, date }))
      .sort((a, b) => b.amount - a.amount)
    : [];
  const productData = data
    ? Object.entries(data.quantityByProduct)
      .map(([name, { quantity, date }]) => ({ name, quantity, date }))
      .sort((a, b) => b.quantity - a.quantity)
    : [];
  const pProductData = data
    ? Object.entries(data.quantityPProducts)
      .map(([name, { quantity, date }]) => ({ name, quantity, date }))
      .sort((a, b) => b.quantity - a.quantity)
    : [];
  const branchData = data
    ? Object.entries(data.salesByBranch)
      .map(([branch, { amount, date }]) => ({ branch, amount, date }))
      .sort((a, b) => b.amount - a.amount)
    : [];

  const customerTop10 = filterByDate(
    filterBySearch(customerData, searchQuery),
    startDate,
    endDate
  ).slice(0, 10); // Limit chart to top 10
  const productTop10 = filterByDate(
    filterBySearch(productData, searchQuery),
    startDate,
    endDate
  ).slice(0, 10); // Limit chart to top 10
  const pProductTop10 = filterByDate(
    filterBySearch(pProductData, searchQuery),
    startDate,
    endDate
  ).slice(0, 10); // Limit chart to top 10
  const branchTop10 = filterByDate(
    filterBySearch(
      branchData.filter(
        (item) =>
          item.branch.startsWith("PNH01") || item.branch.startsWith("KCM01")
      ),
      searchQuery
    ),
    startDate,
    endDate
  ).slice(0, 10); // Limit chart to top 10
  const stockiestBranchTop10 = filterByDate(
    filterBySearch(
      branchData.filter((item) => item.branch.startsWith("KS")),
      searchQuery
    ),
    startDate,
    endDate
  ).slice(0, 10); // Limit chart to top 10

  const customerAll = filterByDate(
    filterBySearch(customerData, searchQuery),
    startDate,
    endDate
  ); // All data for table
  const productAll = filterByDate(
    filterBySearch(productData, searchQuery),
    startDate,
    endDate
  ); // All data for table
  const pProductAll = filterByDate(
    filterBySearch(pProductData, searchQuery),
    startDate,
    endDate
  ); // All data for table
  const branchAll = filterByDate(
    filterBySearch(
      branchData.filter(
        (item) =>
          item.branch.startsWith("PNH01") || item.branch.startsWith("KCM01")
      ),
      searchQuery
    ),
    startDate,
    endDate
  ); // All data for table
  const stockiestBranchAll = filterByDate(
    filterBySearch(
      branchData.filter((item) => item.branch.startsWith("KS")),
      searchQuery
    ),
    startDate,
    endDate
  ); // All data for table

  const totalSales = data
    ? Object.values(data.salesByCustomer)
      .reduce((sum, val) => sum + val.amount, 0)
      .toFixed(2)
    : "0.00";
  const topProduct =
    data && productData.length > 0
      ? productData[0]
      : { name: "N/A", quantity: 0 };

  // Render content based on selected menu
  const renderContent = () => {
    let filteredDataGraph = [];
    let filteredDataTable = [];
    switch (selectedMenu) {
      case "Summary":
        return (
          <div className="summary-section bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-blue-700">Summary</h2>
              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
              </div>
            </div>
            <p className="text-lg">
              <strong>Total Sales:</strong> $ {totalSales} USD
            </p>
            <p className="text-lg">
              <strong>Number of Purchases:</strong>{" "}
              {data ? data.purchaseCount : 0}
            </p>
            <p className="text-lg">
              <strong>Quantity of Products Starting with P:</strong>{" "}
              {data ? data.totalQuantityPProducts : 0} units
            </p>
            <p className="text-lg">
              <strong>Interesting Fact:</strong> The best-selling product is "
              {topProduct.name}" with {topProduct.quantity} units sold,
              indicating high popularity.
            </p>
            <p className="text-lg">
              Sales data for May 24, 2025, shows strong performance across
              multiple branches, with significant contributions from major
              customers and top products. The best-selling product is "
              {topProduct.name}", indicating high popularity, possibly due to
              high PV value or special promotions. Products starting with "P"
              have a total sales quantity of{" "}
              {data ? data.totalQuantityPProducts : 0} units, highlighting their
              importance in the product category. Branches such as PNH01 and
              KS003 have high sales, indicating key market areas.
            </p>
          </div>
        );
      case "Sales by Customer":
        filteredDataGraph = customerTop10;
        filteredDataTable = customerAll;
        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">
                Sales by Customer : Top 10
              </h2>
              <div>
                {/* <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                /> */}
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
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  fontSize={12}
                />
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
                <Bar dataKey="amount" fill="#3B82F6" name="Sales" />
              </BarChart>
            </ResponsiveContainer>
            {customerData.length > 0 && (
              <div>
                <div className="scroll-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Sales (USD)</th>
                        {/* <th>Date</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataTable.map((item) => (
                        <tr key={item.name}>
                          <td>{item.name}</td>
                          <td>{item.amount.toFixed(2)}</td>
                          {/* <td>{formatDateForDisplay(item.date)}</td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 font-semibold text-xl">
                  Member Total : {filteredDataTable.length} ID
                </p>
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
              <h2 className="text-2xl font-semibold text-gray-800">
                Quantity Sold by Product : Top 10
              </h2>
              <div>
                {/* <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                /> */}
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
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  fontSize={12}
                />
                <YAxis
                  label={{
                    value: "Quantity",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                  }}
                  fontSize={12}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantity" fill="#10B981" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
            {productData.length > 0 && (
              <div>
                <div className="scroll-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        {/* <th>Date</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataTable.map((item) => (
                        <tr key={item.name}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          {/* <td>{formatDateForDisplay(item.date)}</td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 font-semibold text-xl">
                  Products Items : {filteredDataTable.length} Items
                </p>
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
              <h2 className="text-2xl font-semibold text-gray-800">
                Quantity of Products Promotion Top 5
              </h2>
              <div>
                {/* <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                /> */}
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
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  fontSize={12}
                />
                <YAxis
                  label={{
                    value: "Quantity",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                  }}
                  fontSize={12}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantity" fill="#F97316" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
            {pProductData.length > 0 && (
              <div>
                <div className="scroll-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        {/* <th>Date</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataTable.map((item) => (
                        <tr key={item.name}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          {/* <td>{formatDateForDisplay(item.date)}</td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 font-semibold text-xl">
                  Promotion Items : {filteredDataTable.length} Items
                </p>
              </div>
            )}
          </div>
        );
      case "Sales by Branch":
        filteredDataGraph = branchTop10;
        filteredDataTable = branchAll;
        return (
          <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">
                Sales by Branch
              </h2>
              <div>
                {/* <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                /> */}
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
                <Bar dataKey="amount" fill="#8B5CF6" name="Sales" />
              </BarChart>
            </ResponsiveContainer>
            {branchData.length > 0 && (
              <div className="scroll-table">
                <table>
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Sales (USD)</th>
                      {/* <th>Date</th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDataTable.map((item) => (
                      <tr key={item.branch}>
                        <td>{item.branch}</td>
                        <td>{item.amount.toFixed(2)}</td>
                        {/* <td>{formatDateForDisplay(item.date)}</td> */}
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
              <h2 className="text-2xl font-semibold text-gray-800">
                Sales by Stockiest Branch
              </h2>
              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mr-2 p-2 border rounded"
                />
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
                <Bar dataKey="amount" fill="#8B5CF6" name="Sales" />
              </BarChart>
            </ResponsiveContainer>
            {branchData.length > 0 && (
              <div className="scroll-table">
                <table>
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Sales (USD)</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDataTable.map((item) => (
                      <tr key={item.branch}>
                        <td>{item.branch}</td>
                        <td>{item.amount.toFixed(2)}</td>
                        <td>{formatDateForDisplay(item.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      {/* Sidebar */}
      <div className="sidebar">
        <img src={scm_log} width={170} alt="logo" className="mb-5 pl-3" />
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
              {menu}
            </li>
          ))}
        </ul>
      </div>
      {/* Content */}
      <div className="content flex-1">
        <div className="header bg-gradient-to-r from-blue-900 to-blue-500 text-white p-6 rounded-t-lg text-center space-y-2">
          <h1 className="text-5xl font-bold">Sales Report</h1>
          <div className="text-lg flex space-y-1 justify-center gap-2">
            <div>
              <strong>File Name :</strong> {fileName || "N/A"} |{" "}
            </div>
            <div>
              <strong>Date Range:</strong> {formatDateRange(dateRange)}
            </div>
          </div>
        </div>
        <div className="upload-section bg-white p-6 rounded-b-lg shadow-lg mb-8 text-center flex gap-4">
          <div className="flex justify-center items-center gap-1">
            <FaFileExcel size={35} className="text-green-700" />
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="upload-btn px-4 py-2 2/12 border border-green-700 text-green-700 rounded hover:bg-green-700 cursor-pointer hover:text-white"
              onChange={handleFileUpload}
            />
          </div>
          <button
            onClick={clearLocalStorage}
            className="clear-btn px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
          >
            Clear Data
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default App;