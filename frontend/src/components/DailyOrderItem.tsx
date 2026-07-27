import React, { useState, useEffect, useMemo } from "react";
import { X, Printer, Receipt } from "lucide-react";

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

interface Order {
  id: string;
  _id: string;
  restaurantId: string;
  customerName: string;
  tableNumber: string | number;
  orderNote?: string;
  items: OrderItem[];
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

interface TotalOrderProps {
  restaurantId?: string;
}

const TotalOrder: React.FC<TotalOrderProps> = ({ restaurantId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showBill, setShowBill] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [restaurantId]);

  const API_BASE_URL = 'https://rms-0wk0.onrender.com/api'; 

const fetchOrders = async () => {
  setLoading(true);
  setError(null);
  try {
    const url = restaurantId
      ? `${API_BASE_URL}/orders?restaurantId=${restaurantId}`
      : `${API_BASE_URL}/orders`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
  console.log("Raw orders:", data.data.map(o => o.orderStatus));
  setOrders(data.data);
}else {
      setError(data.message || "Failed to fetch orders.");
    }
  } catch (err) {
    console.error("Fetch orders error:", err);
    setError("Error fetching orders data.");
  } finally {
    setLoading(false);
  }
};

  // Only completed & served orders
const completedOrders = useMemo(
  () =>
    orders.filter((o) => {
      const status = o.orderStatus?.toLowerCase().trim();
      return status && !["cancelled", "canceled", "pending"].includes(status);
    }),
  [orders]
);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleViewBill = (dateStr: string) => {
    setSelectedDate(formatDate(dateStr));
    setShowBill(true);
  };

  // Orders for the selected date
  const ordersForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return completedOrders.filter(
      (o) => formatDate(o.createdAt) === selectedDate
    );
  }, [completedOrders, selectedDate]);

  // Aggregate items sold for the selected date -> { "Egg Noodles": 7, ... }
  const aggregatedItems = useMemo(() => {
    const map: Record<string, { qty: number; price: number; total: number }> = {};
    ordersForSelectedDate.forEach((order) => {
      order.items?.forEach((item) => {
        const name = item.name;
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        if (!map[name]) {
          map[name] = { qty: 0, price, total: 0 };
        }
        map[name].qty += qty;
        map[name].total += qty * price;
      });
    });
    return Object.entries(map).map(([name, val]) => ({
      name,
      qty: val.qty,
      price: val.price,
      total: val.total,
    }));
  }, [ordersForSelectedDate]);

  const grandTotal = useMemo(
    () => aggregatedItems.reduce((sum, item) => sum + item.total, 0),
    [aggregatedItems]
  );

  const totalOrdersCount = ordersForSelectedDate.length;

  const handlePrint = () => {
    const printContent = document.getElementById("bill-print-area");
    if (!printContent) return;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Sales Bill</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
            }
            body {
              width: 80mm;
              margin: 0;
              padding: 8px;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider {
              border-top: 1px dashed #000;
              margin: 6px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              text-align: left;
              padding: 2px 0;
            }
            th:last-child, td:last-child {
              text-align: right;
            }
            .item-row td {
              padding: 3px 0;
            }
            .total-row {
              font-weight: bold;
              font-size: 13px;
            }
            .header-title {
              font-size: 16px;
              font-weight: bold;
            }
            .small {
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <p className="text-gray-500">Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Completed & Served Orders
      </h1>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Table
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Items
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                Bill
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {completedOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No completed or served orders found.
                </td>
              </tr>
            ) : (
              completedOrders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDisplayDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {order.customerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {order.tableNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {order.items?.map((i) => i.name).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                    Rs. {order.totalAmount}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 capitalize">
                      {order.orderStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleViewBill(order.createdAt)}
                      className="inline-flex items-center justify-center p-2 rounded-full hover:bg-orange-100 text-orange-600 transition"
                      title="View day's sales bill"
                    >
                      <Receipt size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bill Modal */}
      {showBill && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-800">Sales Bill</h2>
              <button
                onClick={() => setShowBill(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable 80mm bill area */}
            <div className="p-4 flex justify-center bg-gray-50">
              <div
                id="bill-print-area"
                style={{
                  width: "80mm",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "12px",
                  padding: "8px",
                  background: "#fff",
                }}
              >
                <div className="center bold header-title" style={{ textAlign: "center", fontWeight: "bold", fontSize: "16px" }}>
                  DAILY SALES BILL
                </div>
                <div className="center small" style={{ textAlign: "center", fontSize: "10px" }}>
                  Date: {formatDisplayDate(selectedDate)}
                </div>
                <div className="center small" style={{ textAlign: "center", fontSize: "10px" }}>
                  Total Orders: {totalOrdersCount}
                </div>

                <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "2px 0" }}>Item</th>
                      <th style={{ textAlign: "right", padding: "2px 0" }}>Qty</th>
                      <th style={{ textAlign: "right", padding: "2px 0" }}>Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", padding: "10px 0" }}>
                          No sales for this date.
                        </td>
                      </tr>
                    ) : (
                      aggregatedItems.map((item, idx) => (
                        <tr key={idx} className="item-row">
                          <td style={{ padding: "3px 0" }}>{item.name}</td>
                          <td style={{ textAlign: "right", padding: "3px 0" }}>
                            {item.qty}
                          </td>
                          <td style={{ textAlign: "right", padding: "3px 0" }}>
                            {item.total > 0 ? item.total.toFixed(2) : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                <div
                  className="total-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: "bold",
                    fontSize: "13px",
                  }}
                >
                  <span>Grand Total</span>
                  <span>Rs. {grandTotal.toFixed(2)}</span>
                </div>

                <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                <div className="center small" style={{ textAlign: "center", fontSize: "10px" }}>
                  Thank you!
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 flex gap-2 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowBill(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center gap-2 transition"
              >
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TotalOrder;
