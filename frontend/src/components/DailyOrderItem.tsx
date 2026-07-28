import React, { useState, useEffect, useMemo } from "react";
import { X, Printer, Receipt } from "lucide-react";

const API_BASE_URL = 'https://rms-0wk0.onrender.com/api';

interface OrderItem {
  itemName: string;
  description?: string;
  itemPrice: number;
  quantity: number;
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

const getLoggedInUser = () => {
  try {
    const raw = localStorage.getItem('pharmacyUser');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface TotalOrderProps {
  restaurantId?: string;
}

const TotalOrder: React.FC<TotalOrderProps> = ({ restaurantId: propRestaurantId }) => {
  const user = getLoggedInUser();
  const restaurantId = propRestaurantId || (user?.id ? String(user.id) : '');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showBill, setShowBill] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [restaurantId]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = restaurantId
        ? `${API_BASE_URL}/orders?restaurantId=${encodeURIComponent(restaurantId)}`
        : `${API_BASE_URL}/orders`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      } else {
        setError(data.message || "Failed to fetch orders.");
      }
    } catch (err) {
      console.error("Fetch orders error:", err);
      setError("Error fetching orders data.");
    } finally {
      setLoading(false);
    }
  };

  const completedOrders = useMemo(
    () =>
      orders.filter((o) => {
        const status = o.orderStatus?.toLowerCase().trim();
        const matchesRestaurant = !restaurantId || String(o.restaurantId) === String(restaurantId);
        return (status === "completed" || status === "served") && matchesRestaurant;
      }),
    [orders, restaurantId]
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

  // Group completed orders by date -> one row per day
  const dailySummaries = useMemo(() => {
    const map: Record<string, { date: string; orders: Order[]; totalAmount: number; orderCount: number }> = {};
    completedOrders.forEach((order) => {
      const dateKey = formatDate(order.createdAt);
      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, orders: [], totalAmount: 0, orderCount: 0 };
      }
      map[dateKey].orders.push(order);
      map[dateKey].totalAmount += Number(order.totalAmount) || 0;
      map[dateKey].orderCount += 1;
    });
    return Object.values(map).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [completedOrders]);

  const handleViewBill = (dateKey: string) => {
    setSelectedDate(dateKey);
    setShowBill(true);
  };

  const ordersForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return completedOrders.filter((o) => formatDate(o.createdAt) === selectedDate);
  }, [completedOrders, selectedDate]);

  const aggregatedItems = useMemo(() => {
    const map: Record<string, { qty: number; price: number; total: number }> = {};
    ordersForSelectedDate.forEach((order) => {
      order.items?.forEach((item) => {
        const name = item.itemName;
        const qty = Number(item.quantity) || 0;
        const price = Number(item.itemPrice) || 0;
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
            @page { size: 80mm auto; margin: 0; }
            * { box-sizing: border-box; }
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
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { text-align: left; padding: 2px 0; }
            th:last-child, td:last-child { text-align: right; }
            .item-row td { padding: 3px 0; }
            .total-row { font-weight: bold; font-size: 13px; }
            .header-title { font-size: 16px; font-weight: bold; }
            .small { font-size: 10px; }
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
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Daily Sales (Completed Orders)
      </h1>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Total Orders
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Total Sales
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                Bill
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dailySummaries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No completed or served orders found.
                </td>
              </tr>
            ) : (
              dailySummaries.map((day) => (
                <tr key={day.date} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                    {formatDisplayDate(day.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {day.orderCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                    Rs. {day.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleViewBill(day.date)}
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

      {showBill && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-800">Sales Bill</h2>
              <button
                onClick={() => setShowBill(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

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