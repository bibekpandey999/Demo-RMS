const express = require("express");
const cors = require("cors");
const conectDb = require("./connectDb");
const Menu = require("./models/menu");
const Order = require("./models/createOrder");
const Table = require("./models/table");
const Bill = require("./models/bill");
const PharmacyUser = require("./models/login");
const PharmacyStaff = require("./models/loginStaff");
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const mongoose = require('mongoose');

// ... all your require statements ...

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);


const allowedOrigins = [
  "http://localhost:3000",
  "https://rms-pa7b9fs27-ramitnpns-projects.vercel.app"
];
// CORS and JSON parsing set up immediately, not gated on DB connection
app.use(cors({
    origin: true, // Automatically allows any requesting frontend origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200
}));

app.use(express.json());

conectDb();

mongoose.connection.once('open', () => {
    console.log("MongoDB connection established for sessions.");

    app.use(session({
        secret: process.env.SESSION_SECRET || 'your_secret',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            client: mongoose.connection.getClient()
        }),
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        }
    }));

    // Register your routes AFTER session middleware is attached
    // app.use('/api/auth', authRoutes);
    // app.use('/api/patients', patientRoutes);
    // ...etc

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});

mongoose.connection.on('error', (err) => {
    console.error("MongoDB connection error:", err);
});

// Global Helper functions
const getValue = (val, fallback) => (val !== undefined && val !== null && String(val).trim() !== "") ? val : fallback;

// Safe Number parsing helper to prevent NaN database crashes
const parseNum = (val, fallback = 0) => {
    const parsed = Number(val);
    return isNaN(parsed) ? fallback : parsed;
};

// Helper to reliably normalize both Array and String inputs into a Database string string formatting
const parseArrayOrString = (arrayVal, stringVal, fallback = "None") => {
    if (Array.isArray(arrayVal)) return arrayVal.length > 0 ? arrayVal.join(', ') : fallback;
    return getValue(stringVal, fallback);
};




// ==========================================
// Menu
// ==========================================

app.post("/api/menu", async (req, res) => {
    try {
        const formData = req.body;
        console.log("=== INCOMING MENU ITEM DATA ===");
        console.log(formData);

        const newMenuItem = await Menu.create({
            itemName: getValue(formData.itemName, "Unknown Dish"),
            description: getValue(formData.description, "No description provided"),
            category: getValue(formData.category, "Uncategorized"),
            price: parseNum(getValue(formData.price, 0)),
            status: getValue(formData.status, "Available"),
            skuBarcodeReference: getValue(formData.skuBarcodeReference, ""),
            restaurantId: getValue(formData.restaurantId, "")
        });

        return res.status(201).json({ 
            success: true, 
            message: "Menu item added successfully!", 
            data: newMenuItem 
        });

    } catch (error) {
        console.error("🔴 DATABASE WRITE CRASH:", error);
        
        // Handle MongoDB Duplicate Key Error cleanly (e.g., repeating a unique SKU/barcode string)
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                success: false,
                message: `A menu item with this ${duplicateField} ("${error.keyValue[duplicateField]}") already exists! Please use a unique value.`
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: "Failed to save menu item to database.",
            error: error.message 
        });
    }
});

// GET: Fetch All Menu Items (scoped to restaurantId if provided)
app.get("/api/menu", async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const filter = restaurantId ? { restaurantId } : {};

        const dbItems = await Menu.find(filter).sort({ createdAt: -1 });

        const items = dbItems.map(item => {
            return {
                id: item._id,
                _id: item._id,
                itemName: item.itemName,
                description: item.description,
                category: item.category,
                price: item.price,
                status: item.status,
                skuBarcodeReference: item.skuBarcodeReference,
                restaurantId: item.restaurantId,
                createdAt: item.createdAt || new Date().toISOString()
            };
        });

        return res.status(200).json({
            success: true,
            count: items.length,
            data: items 
        });
    } catch (error) {
        console.error("🔴 Backend fetch failed:", error);
        return res.status(500).json({ success: false, message: "Error fetching menu data." });
    }
});

// PUT: Update an Existing Menu Item by ID
app.put("/api/menu/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        console.log(`=== UPDATING MENU ITEM ID: ${id} ===`);

        const updatedFields = {
            itemName: getValue(updateData.itemName, "Unknown Dish"),
            description: getValue(updateData.description, "No description provided"),
            category: getValue(updateData.category, "Uncategorized"),
            price: parseNum(getValue(updateData.price, 0)),
            status: getValue(updateData.status, "Available"),
            skuBarcodeReference: getValue(updateData.skuBarcodeReference, ""),
            restaurantId: getValue(updateData.restaurantId, "")
        };

        const updatedItem = await Menu.findByIdAndUpdate(
            id, 
            { $set: updatedFields }, 
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ success: false, message: "Menu item not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Menu item updated successfully!",
            data: updatedItem
        });
    } catch (error) {
        console.error("🔴 Backend update failed:", error);
        
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                success: false,
                message: `Update rejected! Another item already uses this ${duplicateField}.`
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: "Error updating menu entry.",
            error: error.message 
        });
    }
});

// DELETE: Remove a Menu Item by ID
app.delete("/api/menu/:id", async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`=== DELETING MENU ITEM ID: ${id} ===`);

        const deletedItem = await Menu.findByIdAndDelete(id);

        if (!deletedItem) {
            return res.status(404).json({ success: false, message: "Menu item not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Menu item deleted successfully!",
            deletedItemId: id
        });
    } catch (error) {
        console.error("🔴 Backend deletion failed:", error);
        return res.status(500).json({ success: false, message: "Error deleting menu entry." });
    }
});


// ==========================================
// Order
// ==========================================


app.post("/api/orders", async (req, res) => {
    try {
        const formData = req.body;
        console.log("=== INCOMING ORDER DATA ===");
        console.log(formData);

        const newOrder = await Order.create({
            restaurantId: getValue(formData.restaurantId, ""),
            customerName: getValue(formData.customerName, "Guest"),
            tableNumber: getValue(formData.tableNumber, "N/A"),
            orderNote: getValue(formData.orderNote, ""),
            items: (formData.items || []).map(i => ({
    itemName: i.itemName || "Unknown Item",
    description: i.description || "",
    itemPrice: Number(i.itemPrice) || 0,
    quantity: Number(i.quantity) || 1,
})),
            totalAmount: parseNum(getValue(formData.totalAmount, 0)),
            orderStatus: getValue(formData.orderStatus, "Pending"),
            paymentStatus: getValue(formData.paymentStatus, "Unpaid")
        });

        return res.status(201).json({
            success: true,
            message: "Order created successfully!",
            data: newOrder
        });

    } catch (error) {
        console.error("🔴 DATABASE WRITE CRASH:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save order to database.",
            error: error.message
        });
    }
});

app.get("/api/orders", async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const filter = restaurantId ? { restaurantId } : {};

        const dbItems = await Order.find(filter).sort({ createdAt: -1 });

        const items = dbItems.map(item => ({
            id: item._id,
            _id: item._id,
            restaurantId: item.restaurantId,
            customerName: item.customerName,
            tableNumber: item.tableNumber,
            orderNote: item.orderNote,
            items: item.items,
            totalAmount: item.totalAmount,
            orderStatus: item.orderStatus,
            paymentStatus: item.paymentStatus,
            createdAt: item.createdAt || new Date().toISOString()
        }));

        return res.status(200).json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        console.error("🔴 Backend fetch failed:", error);
        return res.status(500).json({ success: false, message: "Error fetching orders data." });
    }
});

app.put("/api/orders/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Dynamically build the update object based on what was sent
        const updatedFields = {};
        if (updateData.restaurantId !== undefined) updatedFields.restaurantId = updateData.restaurantId;
        if (updateData.customerName !== undefined) updatedFields.customerName = updateData.customerName;
        if (updateData.tableNumber !== undefined) updatedFields.tableNumber = updateData.tableNumber;
        if (updateData.orderNote !== undefined) updatedFields.orderNote = updateData.orderNote;
        if (updateData.totalAmount !== undefined) updatedFields.totalAmount = Number(updateData.totalAmount);
        if (updateData.orderStatus !== undefined) updatedFields.orderStatus = updateData.orderStatus;
        if (updateData.paymentStatus !== undefined) updatedFields.paymentStatus = updateData.paymentStatus;
        
        if (updateData.items) {
            updatedFields.items = updateData.items.map(i => ({
                itemName: i.itemName || "Unknown Item",
                description: i.description || "",
                itemPrice: Number(i.itemPrice) || 0,
                quantity: Number(i.quantity) || 1,
            }));
        }

        const updatedItem = await Order.findByIdAndUpdate(
            id,
            { $set: updatedFields },
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Order updated successfully!",
            data: updatedItem
        });
    } catch (error) {
        console.error("🔴 Backend update failed:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating order entry.",
            error: error.message
        });
    }
});

app.delete("/api/orders/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedItem = await Order.findByIdAndDelete(id);

        if (!deletedItem) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Order deleted successfully!",
            deletedItemId: id
        });
    } catch (error) {
        console.error("🔴 Backend deletion failed:", error);
        return res.status(500).json({ success: false, message: "Error deleting order entry." });
    }
});



// ==========================================
// Table
// ==========================================



app.post("/api/tables", async (req, res) => {
    try {
        const formData = req.body;
        console.log("=== INCOMING TABLE DATA ===");
        console.log(formData);

        const newTable = await Table.create({
            restaurantId: getValue(formData.restaurantId, ""),
            tableName: getValue(formData.tableName, "Table 1"),
            capacity: parseNum(getValue(formData.capacity, 2)),
            status: getValue(formData.status, "Available")
        });

        return res.status(201).json({ 
            success: true, 
            message: "Table added successfully!", 
            data: newTable 
        });

    } catch (error) {
        console.error("🔴 DATABASE WRITE CRASH:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to save table to database.",
            error: error.message 
        });
    }
});

// GET: Fetch All Tables (scoped to restaurantId if provided)
app.get("/api/tables", async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const filter = restaurantId ? { restaurantId } : {};

        const dbItems = await Table.find(filter).sort({ createdAt: -1 });

        const items = dbItems.map(item => ({
            id: item._id,
            _id: item._id,
            restaurantId: item.restaurantId,
            tableName: item.tableName,
            capacity: item.capacity,
            status: item.status,
            createdAt: item.createdAt || new Date().toISOString()
        }));

        return res.status(200).json({
            success: true,
            count: items.length,
            data: items 
        });
    } catch (error) {
        console.error("🔴 Backend fetch failed:", error);
        return res.status(500).json({ success: false, message: "Error fetching tables data." });
    }
});

// PUT: Update an Existing Table by ID
app.put("/api/tables/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        console.log(`=== UPDATING TABLE ID: ${id} ===`);

        const updatedFields = {
            restaurantId: getValue(updateData.restaurantId, ""),
            tableName: getValue(updateData.tableName, "Table 1"),
            capacity: parseNum(getValue(updateData.capacity, 2)),
            status: getValue(updateData.status, "Available")
        };

        const updatedItem = await Table.findByIdAndUpdate(
            id, 
            { $set: updatedFields }, 
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ success: false, message: "Table not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Table updated successfully!",
            data: updatedItem
        });
    } catch (error) {
        console.error("🔴 Backend update failed:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error updating table entry.",
            error: error.message 
        });
    }
});

// DELETE: Remove a Table by ID
app.delete("/api/tables/:id", async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`=== DELETING TABLE ID: ${id} ===`);

        const deletedItem = await Table.findByIdAndDelete(id);

        if (!deletedItem) {
            return res.status(404).json({ success: false, message: "Table not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Table deleted successfully!",
            deletedItemId: id
        });
    } catch (error) {
        console.error("🔴 Backend deletion failed:", error);
        return res.status(500).json({ success: false, message: "Error deleting table entry." });
    }
});



// ==========================================
// 🧾 BILLS ROUTES
// ==========================================


app.post("/api/bills", async (req, res) => {
    try {
        const formData = req.body;
        console.log("=== INCOMING BILL DATA ===");
        console.log(formData);

        const newBill = await Bill.create({
            restaurantName: getValue(formData.restaurantName, "Unknown Restaurant"),
            location: getValue(formData.location, "N/A"),
            panOrVat: getValue(formData.panOrVat, "N/A"),
            invoiceNo: getValue(formData.invoiceNo, `INV-${Date.now()}`),
            billTo: getValue(formData.billTo, "Anonymous Customer"),
            tableNumber: getValue(formData.tableNumber, "N/A"),
            paymentMethod: getValue(formData.paymentMethod, "Cash"),
            date: formData.date ? new Date(formData.date) : new Date(),
            items: (formData.items || []).map(i => ({
                itemName: i.itemName || "Unknown Item",
                quantity: parseNum(getValue(i.quantity, 1)),
                rate: parseNum(getValue(i.rate, 0)),
                total: parseNum(getValue(i.total, 0)),
            })),
            subtotal: parseNum(getValue(formData.subtotal, 0)),
            discount: parseNum(getValue(formData.discount, 0)),
            taxableAmount: parseNum(getValue(formData.taxableAmount, 0)),
            vatCollected: parseNum(getValue(formData.vatCollected, 0)),
            grandTotal: parseNum(getValue(formData.grandTotal, 0)),
            restaurantId: getValue(formData.restaurantId, "")
        });

        return res.status(201).json({
            success: true,
            message: "Bill generated and saved successfully!",
            data: newBill
        });
    } catch (error) {
        console.error("🔴 BILL WRITE CRASH:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to write billing record to database.",
            error: error.message
        });
    }
});

app.get("/api/bills", async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const filter = restaurantId ? { restaurantId } : {};

        const dbBills = await Bill.find(filter).sort({ createdAt: -1 });

        const bills = dbBills.map(bill => {
            return {
                id: bill._id,
                _id: bill._id,
                restaurantName: bill.restaurantName,
                location: bill.location,
                panOrVat: bill.panOrVat,
                invoiceNo: bill.invoiceNo,
                billTo: bill.billTo,
                tableNumber: bill.tableNumber,
                paymentMethod: bill.paymentMethod,
                date: bill.date,
                items: bill.items,
                subtotal: bill.subtotal,
                discount: bill.discount,
                taxableAmount: bill.taxableAmount,
                vatCollected: bill.vatCollected,
                grandTotal: bill.grandTotal,
                restaurantId: bill.restaurantId,
                createdAt: bill.createdAt
            };
        });

        return res.status(200).json({
            success: true,
            count: bills.length,
            data: bills
        });
    } catch (error) {
        console.error("🔴 Backend bills fetch failed:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching billing metrics from database."
        });
    }
});






app.post("/api/auth/login", async (req, res) => {
    try {
        const { pharmacyName, id, password } = req.body;

         if (!pharmacyName || !id || !password) {
           return res.status(400).json({ success: false, message: "Pharmacy name, ID and password are required." });
        }

        const pharmacy = await PharmacyUser.findOne({ id });
        if (!pharmacy) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

           const dbPharmacyName = (pharmacy.pharmacyName || "").trim().toLowerCase();
        const submittedPharmacyName = pharmacyName.trim().toLowerCase();

        if (dbPharmacyName !== submittedPharmacyName) {
            return res.status(401).json({ success: false, message: "Pharmacy name does not match our records." });
        }


        if (!pharmacy.isActive) {
            return res.status(403).json({ success: false, message: "Account is deactivated. Contact Admin." });
        }

        if (pharmacy.password !== password) {
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            user: {
                _id: pharmacy._id,
                id: pharmacy.id,
                pharmacyName: pharmacy.pharmacyName,
                phone: pharmacy.phone,      
                email: pharmacy.email,     
                location: pharmacy.location,
                PanOrVat: pharmacy.PanOrVat,
                isAdmin: pharmacy.isAdmin   
            }
        });

    } catch (error) {
        console.error("🔴 LOGIN ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error during login." });
    }
});
/**
 * 🛠️ USED BY: ADMIN DASHBOARD
 * POST: Create/Register a new Pharmacy User account
 * URL: /api/admin/users
 */
app.post("/api/admin/users", async (req, res) => {
    try {
        const { pharmacyName, id, password, phone, email, location, PanOrVat } = req.body;

        if (!pharmacyName || !id || !password || !phone || !email || !location) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const existingUser = await PharmacyUser.findOne({ id });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User ID already exists." });
        }

        const newPharmacy = await PharmacyUser.create({
            pharmacyName,
            id,
            password: password, 
            phone, 
            email,   
            location,
            PanOrVat,
            isActive: true
        });

        return res.status(201).json({
            success: true,
            message: "New pharmacy user created successfully by Admin!",
            data: newPharmacy
        });

    } catch (error) {
        console.error("🔴 ADMIN USER CREATION ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error while creating user." });
    }
});
/**
 * 🛠️ USED BY: ADMIN DASHBOARD
 * GET: Fetch a single user's profile details (includes plain text password)
 * URL: /api/admin/users/:id
 */
app.get('/api/admin/users', async (req, res) => {
  try {
    const allUsers = await PharmacyUser.find({});
    // We return an array directly in 'data'
    res.json({ success: true, data: allUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
/**
 * 🛠️ USED BY: ADMIN DASHBOARD
 * PUT: Update user properties (includes updating password in plain text)
 * URL: /api/admin/users/:id
 */
app.put("/api/admin/users/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { pharmacyName, id, password, phone, email, location, PanOrVat, isActive } = req.body;

        const pharmacy = await PharmacyUser.findById(userId);
        if (!pharmacy) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (id && id.trim() !== pharmacy.id) {
            const existing = await PharmacyUser.findOne({ id: id.trim() });
            if (existing) {
                return res.status(400).json({ success: false, message: "That ID is already taken." });
            }
            pharmacy.id = id.trim();
        }

        if (pharmacyName) pharmacy.pharmacyName = pharmacyName;
        if (phone) pharmacy.phone = phone;
        if (email) pharmacy.email = email;
        if (location) pharmacy.location = location;
        if (PanOrVat !== undefined) pharmacy.PanOrVat = PanOrVat;
        if (password) pharmacy.password = password;
        if (isActive !== undefined) pharmacy.isActive = isActive;

        await pharmacy.save();

        return res.status(200).json({
            success: true,
            message: "Updated successfully.",
            data: {
                _id: pharmacy._id,
                id: pharmacy.id,
                pharmacyName: pharmacy.pharmacyName,
                phone: pharmacy.phone,
                email: pharmacy.email,
                location: pharmacy.location,
                PanOrVat: pharmacy.PanOrVat,
                isActive: pharmacy.isActive,
                isAdmin: pharmacy.isAdmin
            }
        });
    } catch (error) {
        console.error("🔴 UPDATE USER ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error during update." });
    }
});
/**
 * 🛠️ USED BY: ADMIN DASHBOARD
 * DELETE: Completely remove a Pharmacy User account from DB
 * URL: /api/admin/users/:id
 */
app.delete("/api/admin/users/:id", async (req, res) => {
    try {
        const deletedUser = await PharmacyUser.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ success: false, message: "Account profile not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Pharmacy account permanently deleted by Admin."
        });
    } catch (error) {
        console.error("🔴 ADMIN DELETE USER ERROR:", error);
        return res.status(500).json({ success: false, message: "Error deleting account." });
    }
});

// ==========================================
// 👥 STAFF ROUTES (PharmacyStaff collection ONLY — never PharmacyUser)
// ==========================================

// 1. CREATE: Add new staff login for a specific pharmacy
app.post("/api/staff/login", async (req, res) => {
    const { id, password, pharmacyName } = req.body;
    const staff = await PharmacyStaff.findOne({ id, pharmacyName });
    
    if (staff && staff.password === password) {
        if (staff.isActive === false) {
            return res.status(403).json({ 
                message: "Your account is deactivated. Only active staff can log in." 
            });
        }
        
        res.json({ 
            token: "mock-jwt-token", 
            user: { id: staff.id, staffName: staff.staffName, role: staff.role, pharmacyName: staff.pharmacyName } 
        });
    } else {
        res.status(401).json({ message: "Invalid credentials" });
    }
});


app.post("/api/auth/verify", async (req, res) => {
    const { token, id } = req.body;

    // staff/legacy path
    if (token === "mock-jwt-token") {
        return res.json({ 
            success: true, 
            user: { id: "admin", role: "Manager", pharmacyName: "Your Pharmacy" } 
        });
    }

    // pharmacy path — actually check the DB instead of a hardcoded string
    if (id) {
        const pharmacy = await PharmacyUser.findOne({ id });
        if (pharmacy && pharmacy.isActive) {
            return res.json({
                success: true,
                user: {
                    _id: pharmacy._id,
                    id: pharmacy.id,
                    pharmacyName: pharmacy.pharmacyName,
                    isAdmin: pharmacy.isAdmin
                }
            });
        }
    }

    return res.status(401).json({ success: false, message: "Invalid token" });
});


app.post("/api/staff/create", async (req, res) => {
    try {
        const staffData = req.body;
        const newStaff = await PharmacyStaff.create(staffData);
        res.status(201).json({ success: true, message: "Staff created", data: newStaff });
    } catch (error) {
        res.status(500).json({ error: "Creation failed" });
    }
});

// 2. READ: Get staff ONLY for the pharmacy that was clicked in the dashboard
app.get("/api/admin/staff-by-pharmacy/:pharmacyName", async (req, res) => {
    try {
        const staff = await PharmacyStaff.find({ pharmacyName: req.params.pharmacyName });
        res.status(200).json({ success: true, data: staff });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching staff" });
    }
});

// 3. UPDATE: Update staff by ID (the MongoDB _id)
app.put("/api/staff/:id", async (req, res) => {
    try {
        const updatedStaff = await PharmacyStaff.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedStaff) {
            return res.status(404).json({ error: "Staff member not found" });
        }
        res.status(200).json({ success: true, data: updatedStaff });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. DELETE: Remove staff by ID
app.delete("/api/staff/:id", async (req, res) => {
    try {
        const deleted = await PharmacyStaff.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: "Staff member not found" });
        }
        res.status(200).json({ message: "Staff member deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete staff" });
    }
});

// const createDefaultAdmin = async () => {
//     try {
//         const existingAdmin = await PharmacyUser.findOne({
//             isAdmin: true
//         });

//         if (existingAdmin) {
//             console.log("✅ Admin account already exists");
//             return;
//         }

//         const admin = new PharmacyUser({
//             phone: "0000000000",
//             email: "admin@pharmacy.com",
//             location: "Admin",
//             PanOrVat: "",
//             pharmacyName: "Pharmacy Admin",
//             id: "123",
//             password: "123",
//             isActive: true,
//             isAdmin: true
//         });

//         await admin.save();

//         console.log("✅ Default Pharmacy Admin created successfully");
//         console.log("Admin ID: 123");
//         console.log("Admin Password: 123");

//     } catch (error) {
//         console.error("❌ Admin creation failed:", error.message);
//     }
// };



// Start DB connection before starting server
conectDb().then(() => {
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Pharmacy full-stack server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("❌ Critical System Halt: Server could not start because Database connection failed.");
});


// conectDb().then(async () => {

//   await createDefaultAdmin();

//   app.listen(Number(PORT), "0.0.0.0", () => {
//     console.log(`Pharmacy full-stack server running on port ${PORT}`);
//   });

// }).catch((err) => {
//   console.error("❌ Critical System Halt:", err);
// });
