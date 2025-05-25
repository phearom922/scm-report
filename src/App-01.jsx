// import React, { useState } from "react";
// import {
//   ResponsiveContainer,
//   BarChart,
//   CartesianGrid,
//   XAxis,
//   YAxis,
//   Tooltip,
//   Legend,
//   Bar,
// } from "recharts";
// import * as XLSX from "xlsx";

// const App = () => {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   // จัดการการอัปโหลดไฟล์ Excel และ CSV
//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (!file) return;

//     setLoading(true);
//     setError(null);

//     const reader = new FileReader();
//     reader.onload = (e) => {
//       try {
//         let rawData;
//         const fileExtension = file.name.split(".").pop().toLowerCase();

//         if (fileExtension === "csv") {
//           const text = e.target.result;
//           rawData = parseCSV(text);
//         } else if (["xlsx", "xls"].includes(fileExtension)) {
//           const workbook = XLSX.read(e.target.result, { type: "binary" });
//           const sheetName = workbook.SheetNames[0];
//           const sheet = workbook.Sheets[sheetName];
//           rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
//         } else {
//           throw new Error(
//             "รูปแบบไฟล์ไม่รองรับ: กรุณาใช้ .xlsx, .xls, หรือ .csv"
//           );
//         }

//         const headers = rawData[0].map((h) =>
//           h ? h.toString().trim().replace(/^"|"$/g, "") : ""
//         );
//         const requiredColumns = [
//           "memberName",
//           "totalAmount",
//           "orderCount",
//           "productName",
//           "productCode",
//           "branchTransactionCode",
//           "purchaseDate",
//         ];
//         const missingColumns = requiredColumns.filter(
//           (col) => !headers.includes(col)
//         );
//         if (missingColumns.length > 0) {
//           throw new Error("ไฟล์ขาดคอลัมน์: " + missingColumns.join(", "));
//         }

//         const dataRows = rawData.slice(1).map((row) =>
//           row.reduce((obj, val, i) => {
//             obj[headers[i]] = val
//               ? val.toString().trim().replace(/^"|"$/g, "")
//               : "";
//             return obj;
//           }, {})
//         );

//         const cleanedData = processAndCleanData(dataRows);
//         setData(cleanedData);
//         setLoading(false);
//       } catch (err) {
//         console.error("Error processing file:", err);
//         setError("เกิดข้อผิดพลาด: " + err.message);
//         setLoading(false);
//       }
//     };
//     reader.onerror = () => {
//       setError("เกิดข้อผิดพลาดในการอ่านไฟล์");
//       setLoading(false);
//     };

//     if (file.name.endsWith(".csv")) {
//       reader.readAsText(file);
//     } else {
//       reader.readAsBinaryString(file);
//     }
//   };

//   // ฟังก์ชันสำหรับแยก CSV
//   const parseCSV = (csvText) => {
//     const rows = csvText.split(/\r?\n/);
//     return rows.map((row) =>
//       row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
//     );
//   };

//   // ฟังก์ชันประมวลผลและทำความสะอาดข้อมูล
//   const processAndCleanData = (rawData) => {
//     const salesByCustomer = {};
//     const quantityByProduct = {};
//     const salesByBranch = {};
//     const quantityPProducts = {};
//     let totalQuantityPProducts = 0;

//     rawData.forEach((row) => {
//       if (!row["memberName"] || !row["branchTransactionCode"]) return;

//       const totalAmount = parseFloat(row["totalAmount"]) || 0;
//       const orderCount = parseInt(row["orderCount"]) || 0;
//       const customer = row["memberName"];
//       const product = row["productName"] || "Unknown";
//       const branch = row["branchTransactionCode"];
//       const productCode = row["productCode"] || "";
//       const purchaseDate = row["purchaseDate"] || "N/A"; // สมมติคอลัมน์วันที่

//       if (totalAmount > 0) {
//         if (!salesByCustomer[customer])
//           salesByCustomer[customer] = { amount: 0, date: purchaseDate };
//         salesByCustomer[customer].amount += totalAmount;
//       }
//       if (orderCount > 0 && product !== "Unknown") {
//         if (!quantityByProduct[product])
//           quantityByProduct[product] = { quantity: 0, date: purchaseDate };
//         quantityByProduct[product].quantity += orderCount;
//       }
//       if (totalAmount > 0) {
//         if (!salesByBranch[branch])
//           salesByBranch[branch] = { amount: 0, date: purchaseDate };
//         salesByBranch[branch].amount += totalAmount;
//       }
//       if (orderCount > 0 && productCode.startsWith("P")) {
//         if (!quantityPProducts[product])
//           quantityPProducts[product] = { quantity: 0, date: purchaseDate };
//         quantityPProducts[product].quantity += orderCount;
//         totalQuantityPProducts += orderCount;
//       }
//     });

//     return {
//       salesByCustomer,
//       quantityByProduct,
//       salesByBranch,
//       totalQuantityPProducts,
//       quantityPProducts,
//     };
//   };

//   // ถ้ายังไม่มีข้อมูล แสดงหน้าจออัปโหลดไฟล์
//   if (!data) {
//     return (
//       <div className="container max-w-screen-xl mx-auto p-4">
//         <div className="header bg-blue-900 text-white p-6 rounded-t-lg text-center">
//           <h1 className="text-4xl font-bold">รายงานยอดขาย - 24 พฤษภาคม 2568</h1>
//           <p className="text-lg mt-2">
//             วันที่รายงาน: 24 พฤษภาคม 2568, 08:56 น.
//           </p>
//         </div>
//         <div className="upload-section bg-white p-6 rounded-b-lg shadow-lg mb-8 text-center">
//           <h2 className="text-2xl font-semibold text-blue-700 mb-4">
//             อัปโหลดไฟล์เพื่อดูรายงาน
//           </h2>
//           <input
//             type="file"
//             accept=".xlsx,.xls,.csv"
//             className="upload-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
//             onChange={handleFileUpload}
//           />
//           {error && <p className="error text-red-600 text-lg mt-4">{error}</p>}
//           {loading && (
//             <p className="loading text-lg mt-4">กำลังโหลดข้อมูล...</p>
//           )}
//         </div>
//       </div>
//     );
//   }

//   // แปลงข้อมูลสำหรับกราฟและตาราง
//   const customerData = Object.entries(data.salesByCustomer)
//     .map(([name, { amount, date }]) => ({ name, amount, date }))
//     .sort((a, b) => b.amount - a.amount);

//   const productData = Object.entries(data.quantityByProduct)
//     .map(([name, { quantity, date }]) => ({ name, quantity, date }))
//     .sort((a, b) => b.quantity - a.quantity);

//   const pProductData = Object.entries(data.quantityPProducts)
//     .map(([name, { quantity, date }]) => ({ name, quantity, date }))
//     .sort((a, b) => b.quantity - a.quantity);

//   const branchData = Object.entries(data.salesByBranch)
//     .map(([branch, { amount, date }]) => ({ branch, amount, date }))
//     .sort((a, b) => b.amount - a.amount);

//   const customerTop10 = customerData.slice(0, 10);
//   const productTop10 = productData.slice(0, 10);
//   const pProductTop10 = pProductData.slice(0, 10);
//   const branchTop10 = branchData.slice(0, 10);

//   const totalSales = Object.values(data.salesByCustomer)
//     .reduce((sum, val) => sum + val.amount, 0)
//     .toFixed(2);
//   const topProduct = productData[0];

//   return (
//     <div className="container max-w-screen-xl mx-auto p-4">
//       {/* ส่วนหัว */}
//       <div className="header bg-blue-900 text-white p-6 rounded-t-lg text-center">
//         <h1 className="text-4xl font-bold">รายงานยอดขาย - 24 พฤษภาคม 2568</h1>
//         <p className="text-lg mt-2">วันที่รายงาน: 24 พฤษภาคม 2568, 08:56 น.</p>
//       </div>

//       {/* ส่วนอัปโหลดไฟล์ */}
//       <div className="upload-section bg-white p-6 rounded-b-lg shadow-lg mb-8 text-center border border-gray-300">
//         <input
//           type="file"
//           accept=".xlsx,.xls,.csv"
//           className="upload-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
//           onChange={handleFileUpload}
//         />
//       </div>

//       {/* กราฟและตารางยอดขายตามลูกค้า */}
//       <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
//         <h2 className="text-2xl font-semibold text-blue-700 mb-4">
//           ยอดขายตามลูกค้า (10 อันดับแรก)
//         </h2>
//         <ResponsiveContainer width="100%" height={400}>
//           <BarChart data={customerTop10}>
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={12} />
//             <YAxis
//               label={{
//                 value: "ยอดขาย (USD)",
//                 angle: -90,
//                 position: "insideLeft",
//                 fontSize: 12,
//               }}
//               fontSize={12}
//             />
//             <Tooltip formatter={(value) => `$ ${value.toFixed(2)}`} />
//             <Legend />
//             <Bar dataKey="amount" fill="#3B82F6" name="ยอดขาย" />
//           </BarChart>
//         </ResponsiveContainer>
//         {customerData.length > 10 && (
//           <div className="scroll-table">
//             <table>
//               <thead>
//                 <tr>
//                   <th>วันที่</th>
//                   <th>ลูกค้า</th>
//                   <th>ยอดขาย (USD)</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {customerData.map((item) => (
//                   <tr key={item.name}>
//                     <td>{item.date}</td>
//                     <td>{item.name}</td>
//                     <td>{item.amount.toFixed(2)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* กราฟและตารางจำนวนชิ้นตามสินค้า */}
//       <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
//         <h2 className="text-2xl font-semibold text-blue-700 mb-4">
//           จำนวนชิ้นที่ขายได้ตามสินค้า (10 อันดับแรก)
//         </h2>
//         <ResponsiveContainer width="100%" height={400}>
//           <BarChart data={productTop10}>
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={12} />
//             <YAxis
//               label={{
//                 value: "จำนวนชิ้น",
//                 angle: -90,
//                 position: "insideLeft",
//                 fontSize: 12,
//               }}
//               fontSize={12}
//             />
//             <Tooltip />
//             <Legend />
//             <Bar dataKey="quantity" fill="#10B981" name="จำนวนชิ้น" />
//           </BarChart>
//         </ResponsiveContainer>
//         {productData.length > 10 && (
//           <div className="scroll-table">
//             <table>
//               <thead>
//                 <tr>
//                   <th>วันที่</th>
//                   <th>สินค้า</th>
//                   <th>จำนวนชิ้น</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {productData.map((item) => (
//                   <tr key={item.name}>
//                     <td>{item.date}</td>
//                     <td>{item.name}</td>
//                     <td>{item.quantity}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* กราฟและตารางจำนวนชิ้นของสินค้าที่มีรหัสเริ่มต้นด้วย "P" */}
//       <div className="section bg-white p-6 rounded-lg shadow-lg mb-8 border border-gray-300">
//         <h2 className="text-2xl font-semibold text-blue-700 mb-4">
//           จำนวนชิ้นของสินค้าที่มีรหัสเริ่มต้นด้วย P (10 อันดับแรก)
//         </h2>
//         <ResponsiveContainer width="100%" height={400}>
//           <BarChart data={pProductTop10}>
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={12} />
//             <YAxis
//               label={{
//                 value: "จำนวนชิ้น",
//                 angle: -90,
//                 position: "insideLeft",
//                 fontSize: 12,
//               }}
//               fontSize={12}
//             />
//             <Tooltip />
//             <Legend />
//             <Bar dataKey="quantity" fill="#F97316" name="จำนวนชิ้น" />
//           </BarChart>
//         </ResponsiveContainer>
//         {pProductData.length > 10 && (
//           <div>
//             <div className="scroll-table">
//               <table>
//                 <thead>
//                   <tr>
//                     <th>วันที่</th>
//                     <th>สินค้า</th>
//                     <th>จำนวนชิ้น</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {pProductData.map((item) => (
//                     <tr key={item.name}>
//                       <td>{item.date}</td>
//                       <td>{item.name}</td>
//                       <td>{item.quantity}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//             <p className="mt-4 font-semibold text-xl">Promotion Items : {pProductData.length} Items</p>
//           </div>
//         )}
//       </div>

//       {/* กราฟและตารางยอดขายตามสาขา */}
//       <div className="section bg-white p-6 rounded-lg shadow-lg mb-8">
//         <h2 className="text-2xl font-semibold text-blue-700 mb-4">
//           ยอดขายตามสาขา
//         </h2>
//         <ResponsiveContainer width="100%" height={400}>
//           <BarChart data={branchTop10}>
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="branch" fontSize={12} />
//             <YAxis
//               label={{
//                 value: "ยอดขาย (USD)",
//                 angle: -90,
//                 position: "insideLeft",
//                 fontSize: 12,
//               }}
//               fontSize={12}
//             />
//             <Tooltip formatter={(value) => `$ ${value.toFixed(2)}`} />
//             <Legend />
//             <Bar dataKey="amount" fill="#8B5CF6" name="ยอดขาย" />
//           </BarChart>
//         </ResponsiveContainer>
//         {branchData.length > 10 && (
//           <div className="scroll-table">
//             <table>
//               <thead>
//                 <tr>
//                   <th>วันที่</th>
//                   <th>สาขา</th>
//                   <th>ยอดขาย (USD)</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {branchData.map((item) => (
//                   <tr key={item.branch}>
//                     <td>{item.date}</td>
//                     <td>{item.branch}</td>
//                     <td>{item.amount.toFixed(2)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* ส่วนสรุป */}
//       <div className="summary-section bg-white p-6 rounded-lg shadow-lg">
//         <h2 className="text-2xl font-semibold text-blue-700 mb-4">สรุปผล</h2>
//         <p className="text-lg">
//           <strong>ยอดขายรวม:</strong> $ {totalSales} USD
//         </p>
//         <p className="text-lg">
//           <strong>จำนวนรายการซื้อ:</strong>{" "}
//           {Object.keys(data.salesByCustomer).length}
//         </p>
//         <p className="text-lg">
//           <strong>จำนวนชิ้นของสินค้าที่มีรหัสเริ่มต้นด้วย P:</strong>{" "}
//           {data.totalQuantityPProducts} หน่วย
//         </p>
//         <p className="text-lg">
//           <strong>ข้อเท็จจริงที่น่าสนใจ:</strong> สินค้าขายดีที่สุดคือ "
//           {topProduct.name}" ด้วยจำนวน {topProduct.quantity} หน่วย
//           แสดงถึงความนิยมสูง
//         </p>
//         <p className="text-lg">
//           ข้อมูลยอดขายวันที่ 24 พฤษภาคม 2568 แสดงผลงานที่แข็งแกร่งในหลายสาขา
//           โดยมีส่วนสนับสนุนสำคัญจากลูกค้ารายใหญ่และสินค้าชั้นนำ{" "}
//           สินค้าขายดีที่สุดคือ "{topProduct.name}" แสดงถึงความนิยมสูง
//           อาจเนื่องจากมูลค่า PV สูงหรือโปรโมชันพิเศษ สินค้าที่มีรหัสเริ่มต้นด้วย
//           "P" มียอดขายรวม {data.totalQuantityPProducts} หน่วย
//           แสดงถึงความสำคัญในกลุ่มสินค้า สาขาเช่น PNH01 และ KS003 มียอดขายสูง
//           แสดงถึงพื้นที่ตลาดที่สำคัญ
//         </p>
//       </div>
//     </div>
//   );
// };

// export default App;
