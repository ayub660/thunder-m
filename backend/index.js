require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const dns = require('dns');
const axios = require('axios');
const crypto = require('crypto');

// DNS সেটআপ
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());

// CORS
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const PORT = process.env.PORT || 5000;
const DB_URI = process.env.DB_URI;

// MongoDB
const client = new MongoClient(DB_URI);
let db, paymentLinksCollection, usersCollection, withdrawalsCollection, transactionsCollection;

async function connectDB() {
  try {
    if (db) return; // already connected
    await client.connect();
    db = client.db('thunder_merchant');
    paymentLinksCollection = db.collection('paymentLinks');
    usersCollection = db.collection('users');
    withdrawalsCollection = db.collection('withdrawals');
    transactionsCollection = db.collection('transactions');
    console.log("MongoDB Native Connected Successfully");

    // Master Admin Seed
    const masterEmail = "admin@mamun.com";
    const adminExists = await usersCollection.findOne({ email: masterEmail });
    
    if (!adminExists) {
      await usersCollection.insertOne({
        name: "Master Mamun",
        email: masterEmail,
        password: "admin123",
        role: "master_admin",
        whatsapp: "",
        totalTransactions: "$0.00",
        transactionCount: 0,
        createdAt: new Date()
      });
      console.log("Default Master Admin Created: admin@mamun.com / admin123");
    }
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

// সব রিকোয়েস্টের আগে DB কানেক্ট নিশ্চিত করা
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// --- 1. PAYMENT LINKS ---
app.get('/api/payment-links', async (req, res) => {
  try {
    const { email, role } = req.query;
    let query = {};
    
    const isMasterAdmin = (
      role === 'master' || 
      role === 'master_admin' || 
      role === 'admin' || 
      email === 'admin@mamun.com'
    );

    if (!isMasterAdmin && email) {
      query = { userEmail: email };
    }

    const links = await paymentLinksCollection.find(query).toArray();
    res.json(links);
  } catch (error) {
    console.error("Error fetching payment links:", error);
    res.status(500).json({ error: "Failed to fetch payment links" });
  }
});

// --- 2. AUTH LOGIN (JWT যোগ করা হয়েছে) ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required!" });
    }

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid password!" });
    }

    // ★★★ JWT তৈরি ★★★
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      userInfo: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsapp: user.whatsapp || ""
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// --- BTCPAY GATEWAY QR ---
app.post('/api/generate-gateway-qr', async (req, res) => {
    try {
        const { 
            linkId, amount, buyerEmail, userEmail, userId, userName, currency, orderId 
        } = req.body;

        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid amount is required (must be greater than 0)'
            });
        }
        const finalAmount = parsedAmount.toString();
        const finalAmountNumber = parsedAmount;

        const btcpayUrl = process.env.BTCPAY_URL;
        const storeId = process.env.BTCPAY_STORE_ID;
        const apiKey = process.env.BTCPAY_API_KEY;
        const frontendDomain = process.env.FRONTEND_URL || "https://cash-app-pay.netlify.app";
        const dynamicLinkId = linkId || 'pay';

        // FALLBACK MODE
        if (!btcpayUrl || !storeId || !apiKey) {
            const fallbackInvoiceId = 'FALLBACK-' + Date.now();
            const fallbackLink = `${frontendDomain}/${dynamicLinkId}/i/${fallbackInvoiceId}`;
            const qrCodeImageBase64 = await QRCode.toDataURL(fallbackLink);
            
            if (transactionsCollection) {
                try {
                    await transactionsCollection.insertOne({
                        invoiceId: fallbackInvoiceId,
                        payId: fallbackLink,
                        lnInvoice: fallbackLink,
                        name: `Payment for ${linkId || 'Quick Invoice'}`,
                        amount: finalAmountNumber,
                        currency: currency || 'USD',
                        status: "Pending",
                        checkoutLink: fallbackLink,
                        bolt11: fallbackLink,
                        userEmail: userEmail || null,
                        userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
                        userName: userName || null,
                        linkId: linkId || null,
                        createdAt: new Date()
                    });
                } catch (dbErr) {
                    console.error("Fallback DB Insert Error:", dbErr.message);
                }
            }
            
            return res.status(200).json({
                success: true,
                invoiceId: fallbackInvoiceId,
                checkoutLink: fallbackLink,
                amount: finalAmount,
                qrCodeUrl: qrCodeImageBase64,
                bolt11: fallbackLink,
                lightningInvoice: fallbackLink,
                note: "Running on simulated mode because BTCPay env variables are missing."
            });
        }

        // BTCPay MODE
        const normalizedBtcpayUrl = btcpayUrl.endsWith('/') ? btcpayUrl : `${btcpayUrl}/`;
        const endpoint = `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices`;

        const invoiceData = {
            amount: finalAmount,
            currency: currency || 'USD',
            paymentMethods: ["BTC-LightningNetwork", "BTC"], 
            metadata: {
                linkId: linkId || 'CashAppStylePayment',
                orderId: orderId || 'ORDER-' + Date.now(),
                userEmail: userEmail || null
            },
            checkout: {
                speedPolicy: "HighSpeed",
                buyerEmail: buyerEmail || "customer@example.com",
                redirectAutomatically: false 
            }
        };

        let btcpayResponse;
        try {
            btcpayResponse = await axios.post(endpoint, invoiceData, {
                headers: {
                    'Authorization': `token ${apiKey}`, 
                    'Content-Type': 'application/json'
                }
            });
        } catch (btcpayErr) {
            console.error("BTCPay API Rejection Error:", btcpayErr.response?.data || btcpayErr.message);
            return res.status(500).json({
                success: false,
                error: btcpayErr.response?.data?.message || `BTCPay Error: ${btcpayErr.message}`
            });
        }

        const invoice = btcpayResponse.data;
        const invoiceId = invoice.id;
        let checkoutLink = `${frontendDomain}/${dynamicLinkId}/i/${invoiceId}`;

        let bolt11Invoice = "";
        try {
            const paymentMethodsRes = await axios.get(
                `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${invoiceId}/payment-methods`, 
                { headers: { 'Authorization': `token ${apiKey}` } }
            );
            
            if (paymentMethodsRes && paymentMethodsRes.data) {
                const methods = Array.isArray(paymentMethodsRes.data) ? paymentMethodsRes.data : [paymentMethodsRes.data];
                const lightningMethod = methods.find(m => 
                    m.paymentMethod === "BTC-LightningNetwork" || 
                    m.paymentMethodId === "BTC-LightningNetwork" ||
                    (m.destination && m.destination.startsWith('lnbc')) ||
                    (m.bolt11 && m.bolt11.startsWith('lnbc'))
                );
                if (lightningMethod) {
                    bolt11Invoice = lightningMethod.destination || lightningMethod.bolt11 || lightningMethod.paymentLink || "";
                }
            }
        } catch (pmErr) {
            console.error("Could not fetch payment methods for bolt11:", pmErr.message);
        }

        if (!bolt11Invoice) bolt11Invoice = invoiceId;

        let qrCodeImageBase64 = "";
        try {
            qrCodeImageBase64 = await QRCode.toDataURL(checkoutLink, {
                errorCorrectionLevel: 'M',
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' }
            });
        } catch (qrErr) {
            console.error("QR Code Generation Error:", qrErr.message);
            return res.status(500).json({ success: false, error: "Failed to generate QR Code image" });
        }

        if (transactionsCollection) {
            try {
                await transactionsCollection.insertOne({
                    invoiceId,
                    payId: bolt11Invoice,      
                    lnInvoice: bolt11Invoice,    
                    name: `Payment for ${linkId || 'Quick Invoice'}`,
                    amount: finalAmountNumber,
                    currency: currency || 'USD',
                    status: "Pending",
                    checkoutLink,
                    bolt11: bolt11Invoice,
                    userEmail: userEmail || null,
                    userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
                    userName: userName || null,
                    linkId: linkId || null,
                    createdAt: new Date()
                });
            } catch (dbErr) {
                console.error("Database Insert Error:", dbErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            invoiceId,
            checkoutLink,
            amount: finalAmount,
            qrCodeUrl: qrCodeImageBase64,
            bolt11: bolt11Invoice,        
            lightningInvoice: bolt11Invoice,
            lnInvoice: bolt11Invoice
        });

    } catch (error) {
        console.error("Unexpected Server Crash in /api/generate-gateway-qr:", error.message);
        return res.status(500).json({ 
            success: false, 
            error: error.message || "Internal Server Error occurred while generating gateway QR" 
        });
    }
});

// --- BALANCE API ---
app.get('/api/balance', async (req, res) => {
  try {
    const { email, role } = req.query;
    let query = {};
    const isMasterAdmin = (
      role === 'master' || role === 'master_admin' || role === 'admin' || email === 'admin@mamun.com'
    );

    if (!isMasterAdmin && email) {
      query = { userEmail: email };
    }

    const transactions = await transactionsCollection.find(query).toArray();
    const withdrawals = await withdrawalsCollection.find(query).toArray();

    let totalEarnings = 0;
    transactions.forEach(t => {
      const status = (t.status || "").toLowerCase();
      if (status === "paid" || status === "success" || status === "settled") {
        totalEarnings += Number(t.amount || 0);
      }
    });

    let totalWithdrawn = 0;
    let pendingWithdrawn = 0;
    withdrawals.forEach(w => {
      const status = (w.status || "pending").toLowerCase();
      const amt = Number(w.amount || w.originalAmount || 0);
      if (status === "paid" || status === "approved") totalWithdrawn += amt;
      else if (status === "pending") pendingWithdrawn += amt;
    });

    let currentBalance = totalEarnings - totalWithdrawn - pendingWithdrawn;
    if (currentBalance < 0) currentBalance = 0;

    res.json({
      balance: currentBalance,
      myOwnEarnings: totalEarnings,
      teamTotalEarnings: 0,
      totalEarnings,
      totalWithdrawn,
      pendingWithdrawn
    });
  } catch (error) {
    console.error("Failed to fetch balance stats:", error);
    res.status(500).json({ error: "Failed to fetch balance stats" });
  }
});

// --- TRANSACTIONS API ---
app.get('/api/transactions', async (req, res) => {
    try {
        const { userEmail, role, userId } = req.query;
        let query = {};
        const isMasterAdmin = (role === 'master' || role === 'master_admin' || role === 'admin' || userEmail === 'admin@mamun.com');

        if (!isMasterAdmin) {
            let conditions = [];
            if (userEmail) {
                conditions.push({ userEmail });
                conditions.push({ email: userEmail });
            }
            if (userId) {
                conditions.push({ userId });
                if (ObjectId.isValid(userId)) {
                    conditions.push({ userId: new ObjectId(userId) });
                }
            }
            if (conditions.length > 0) query = { $or: conditions };
            else return res.status(400).json({ success: false, error: "User email or ID is required." });
        }

        const transactions = await transactionsCollection.find(query).sort({ createdAt: -1 }).toArray(); 
        res.json({ success: true, transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    } 
});

// --- Webhook ---
app.post("/api/btcpay/webhook", async (req, res) => {
    try {
        const event = req.body;
        const btcpaySig = req.headers['btcpay-sig'];
        const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

        if (WEBHOOK_SECRET && btcpaySig) {
            const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
            const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
            if (btcpaySig !== digest) {
                return res.status(400).send('Invalid signature');
            }
        }

        if (event.type === 'InvoiceSettled' || event.type === 'InvoicePaymentSettled') {
            const invoiceId = event.invoiceId;
            if (transactionsCollection) {
                await transactionsCollection.updateOne(
                    { invoiceId },
                    { $set: { status: 'Paid', bolt11: event.bolt11 || "" } }
                );
            }
        }
        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- WITHDRAWAL ---
app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, userName, userEmail, userId, payoutMethod } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
    if (!userEmail) return res.status(400).json({ success: false, message: "User email is required" });

    const txQuery = { userEmail };
    const transactions = await transactionsCollection.find(txQuery).toArray();
    const withdrawals = await withdrawalsCollection.find(txQuery).toArray();

    let totalEarnings = 0;
    transactions.forEach(t => {
      const status = (t.status || "").toLowerCase();
      if (["paid", "success", "settled"].includes(status)) totalEarnings += Number(t.amount || 0);
    });

    let totalWithdrawn = 0, pendingWithdrawn = 0;
    withdrawals.forEach(w => {
      const status = (w.status || "pending").toLowerCase();
      const amt = Number(w.amount || w.originalAmount || 0);
      if (["paid", "approved"].includes(status)) totalWithdrawn += amt;
      else if (status === "pending") pendingWithdrawn += amt;
    });

    const available = totalEarnings - totalWithdrawn - pendingWithdrawn;
    if (Number(amount) > available) {
      return res.status(400).json({ success: false, message: `Insufficient funds. Available: $${available.toFixed(2)}` });
    }

    await withdrawalsCollection.insertOne({
      userName: userName || "User",
      userEmail,
      userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
      amount: Number(amount),
      originalAmount: Number(amount),
      type: "User Payout",
      payoutMethod: payoutMethod || "Bank Transfer",
      status: "Pending",
      requestTime: new Date().toLocaleString(),
      createdAt: new Date()
    });

    res.status(200).json({ success: true, message: "Withdrawal request submitted successfully", withdrawnAmount: amount });
  } catch (error) {
    console.error("Withdrawal Error:", error);
    res.status(500).json({ success: false, message: "Server error during withdrawal" });
  }
});

app.get('/api/my-withdrawals', async (req, res) => {
  try {
    const { userEmail, role } = req.query;
    let query = {};
    const isMasterAdmin = (role === 'master' || role === 'master_admin' || role === 'admin' || userEmail === 'admin@mamun.com');
    if (!isMasterAdmin && userEmail) query = { userEmail };

    const withdrawals = await withdrawalsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const withdrawals = await withdrawalsCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.status(200).json(withdrawals);
  } catch(error){
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/withdrawals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

    const result = await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: "Withdrawal not found" });
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch(error){
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- USER MANAGEMENT ---
app.get('/api/me', async (req, res) => {
  res.json({ name: "Master Mamun", email: "admin@mamun.com", role: "master_admin" });
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const { role, userId } = req.query;
    let query = {};
    if (role === 'master_admin' || role === 'master' || role === 'admin') {
      query = {}; 
    } else if (userId && ObjectId.isValid(userId)) {
      const uId = new ObjectId(userId);
      query = { $or: [{ _id: uId }, { createdBy: uId }] };
    }
    const users = await usersCollection.find(query).project({ password: 0 }).toArray();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.post('/api/admin/create-user', async (req, res) => {
  try {
    const { name, email, password, role, whatsapp, dollarRate, creatorRole, createdBy } = req.body;
    if (creatorRole === 'single' || !creatorRole) {
      return res.status(403).json({ success: false, message: 'Access Denied: Single users cannot create users!' });
    }
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required!' });
    }
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already exists!' });

    let creatorId = createdBy || null;
    if (creatorId && ObjectId.isValid(creatorId)) creatorId = new ObjectId(creatorId);

    const newUser = {
      name, email, password,
      role: role || 'single',
      whatsapp: whatsapp || '',
      dollarRate: dollarRate !== '' && dollarRate !== undefined ? Number(dollarRate) : 0,
      createdBy: creatorId,
      createdAt: new Date()
    };
    const result = await usersCollection.insertOne(newUser);
    res.status(200).json({ success: true, message: 'User Created Successfully!', _id: result.insertedId, ...newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, role, whatsapp, dollarRate } = req.body;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID!' });

    const updateData = {
      name, email, role, whatsapp,
      dollarRate: dollarRate !== '' && dollarRate !== undefined ? Number(dollarRate) : 0
    };
    if (password && password.trim() !== '') updateData.password = password;

    const result = await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'User not found!' });
    res.status(200).json({ success: true, message: 'User Updated Successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { creatorRole } = req.body;
    if (creatorRole === 'single' || !creatorRole) {
      return res.status(403).json({ success: false, message: 'Access Denied: Unauthorized action!' });
    }
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid user ID format!" });

    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: "User not found!" });
    res.status(200).json({ success: true, message: "User Deleted Successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while deleting user" });
  }
});

// --- PAYMENT LINK CRUD ---
app.post('/api/create-payment-link', async (req, res) => {
  try {
    const { name, url, theme, template, amount, createdAt, userEmail, userId } = req.body;
    const selectedTheme = theme || template || 'light';
    const imagePath = selectedTheme === 'green' ? '/src/asset/cashapp_green.png' : '/src/asset/cashapp_light.png';

    const newLink = {
      name, url,
      theme: selectedTheme,
      template: selectedTheme,
      amount,
      image: imagePath,
      userEmail: userEmail || 'admin@mamun.com',
      userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
      createdAt: createdAt || new Date()
    };
    const result = await paymentLinksCollection.insertOne(newLink);
    res.status(201).json({ success: true, _id: result.insertedId, ...newLink });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get('/api/payment-links/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    let link = null;
    if (ObjectId.isValid(linkId)) {
      link = await paymentLinksCollection.findOne({ _id: new ObjectId(linkId) });
    }
    if (!link) {
      link = await paymentLinksCollection.findOne({ 
        $or: [{ name: linkId }, { url: { $regex: linkId, $options: 'i' } }]
      });
    }
    if (!link) return res.status(404).json({ success: false, error: "Payment link not found" });
    res.json(link);
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.put('/api/payment-links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { theme, template, name, url } = req.body;
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid Link ID format!" });

    let finalTheme = (theme || template || "light").toString().toLowerCase().trim();
    if (finalTheme !== "green") finalTheme = "light";

    const imagePath = finalTheme === "green" ? "/src/asset/cashapp_green.png" : "/src/asset/cashapp_light.png";
    const updateFields = { theme: finalTheme, template: finalTheme, image: imagePath };
    if (name) updateFields.name = name;
    if (url) updateFields.url = url;

    const result = await paymentLinksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: "after" }
    );
    if (!result) return res.status(404).json({ success: false, message: "Payment link not found!" });
    res.status(200).json({ success: true, message: "Payment link and theme updated successfully!", data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error while updating payment link" });
  }
});

app.delete('/api/payment-links/:id', async (req, res) => {
  try {
    const linkId = req.params.id;
    if (!ObjectId.isValid(linkId)) return res.status(400).json({ success: false, error: "Invalid payment link id format" });

    const role = req.query.role || req.body?.role;
    const email = req.query.email || req.body?.email;
    const query = { _id: new ObjectId(linkId) };
    const isMasterAdmin = (role === 'master' || role === 'master_admin' || role === 'admin' || email === 'admin@mamun.com');

    if (!isMasterAdmin) {
      if (!email) return res.status(401).json({ success: false, error: "Unauthorized: Email required to delete link" });
      query.userEmail = email;
    }

    const result = await paymentLinksCollection.deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Payment link not found or you do not have permission to delete it" });
    }
    res.status(200).json({ success: true, message: "Payment link deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});

// --- PASSWORD UPDATE ---
app.put('/api/admin/update-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required!" });
    }
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found!" });
    if (user.password !== oldPassword) {
      return res.status(401).json({ success: false, message: "Incorrect old password!" });
    }
    await usersCollection.updateOne({ email }, { $set: { password: newPassword, updatedAt: new Date() } });
    res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while updating password" });
  }
});

// --- SINGLE TRANSACTION ---
app.get('/api/transactions/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const tx = await transactionsCollection.findOne({ invoiceId });
    if (!tx) return res.status(404).json({ success: false, error: 'Invoice not found' });

    let qrCodeUrl = tx.qrCodeUrl || null;
    if (!qrCodeUrl && tx.checkoutLink) {
      try {
        qrCodeUrl = await QRCode.toDataURL(tx.checkoutLink, { errorCorrectionLevel: 'M', margin: 2 });
      } catch (e) {}
    }

    return res.json({
      success: true,
      transaction: {
        ...tx,
        qrCodeUrl,
        bolt11: tx.bolt11 || tx.lnInvoice || tx.payId,
        lightningInvoice: tx.bolt11 || tx.lnInvoice || tx.payId,
        amount: tx.amount
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// --- OG IMAGE ---
app.get('/og/:username', async (req, res) => {
  try {
    const { username } = req.params;
    let linkData = null;
    if (paymentLinksCollection) {
      linkData = await paymentLinksCollection.findOne({
        $or: [{ name: username }, { linkId: username }, { username: username }]
      });
    }

    const name = (linkData?.name || username || 'Pay').toString();
    const theme = (linkData?.theme || linkData?.template || 'light').toString().toLowerCase();
    const isGreen = theme === 'green';

    const bg = isGreen ? '#00D54B' : '#F4F4F4';
    const text = isGreen ? '#FFFFFF' : '#111111';
    const card = isGreen ? '#00C244' : '#FFFFFF';
    const accent = isGreen ? '#FFFFFF' : '#00D54B';
    const dollarColor = isGreen ? '#00D54B' : '#FFFFFF';
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${bg}"/>
  <rect x="80" y="80" width="1040" height="470" rx="40" fill="${card}"/>
  <circle cx="600" cy="250" r="70" fill="${accent}"/>
  <text x="600" y="278" text-anchor="middle" font-size="80" font-weight="900" font-family="Arial,Helvetica,sans-serif" fill="${dollarColor}">$</text>
  <text x="600" y="380" text-anchor="middle" font-size="52" font-weight="800" font-family="Arial,Helvetica,sans-serif" fill="${text}">Pay ${displayName}</text>
  <text x="600" y="440" text-anchor="middle" font-size="26" font-family="Arial,Helvetica,sans-serif" fill="${isGreen ? '#E8FFF0' : '#666666'}">Send secure payment via Cash App</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(svg);
  } catch (err) {
    return res.status(500).send('Error');
  }
});

// --- SHARE PREVIEW / REDIRECT ---
app.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userAgent = req.headers['user-agent'] || '';
    const isSocialBot = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|SkypeUriPreview|Slackbot/i.test(userAgent);

    let linkData = null;
    if (paymentLinksCollection) {
      linkData = await paymentLinksCollection.findOne({
        $or: [{ name: username }, { linkId: username }, { username: username }]
      });
    }

    if (isSocialBot) {
      const formattedName = username.charAt(0).toUpperCase() + username.slice(1);
      const title = `Pay ${formattedName}`;
      const description = `Send secure payment instantly via Cash App.`;
      const previewImageUrl = `https://thunder-m-r18p.vercel.app/og/${encodeURIComponent(username)}`;
      const currentUrl = `https://thunder-m-r18p.vercel.app/${username}`;

      return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CashApp Pay" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${previewImageUrl}" />
  <meta property="og:image:secure_url" content="${previewImageUrl}" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${currentUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${previewImageUrl}" />
</head>
<body><p>${title}</p></body>
</html>`);
    }

    return res.redirect(302, `https://cash-app-pay.netlify.app/${username}`);
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// --- PAYMENT STATUS ---
app.get('/i/:linkId/status', async (req, res) => {
  try {
    const { linkId } = req.params;
    const transaction = await transactionsCollection.findOne({ invoiceId: linkId });
    const btcpayUrl = process.env.BTCPAY_URL;
    const storeId = process.env.BTCPAY_STORE_ID;
    const apiKey = process.env.BTCPAY_API_KEY;
    const normalizedBtcpayUrl = btcpayUrl ? (btcpayUrl.endsWith('/') ? btcpayUrl : `${btcpayUrl}/`) : '';

    if (!transaction) {
      return res.status(404).json({ status: "not_found" });
    }

    if (normalizedBtcpayUrl && storeId && apiKey && transaction.invoiceId) {
      try {
        const btcpayRes = await axios.get(`${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${transaction.invoiceId}`, {
          headers: { 'Authorization': `token ${apiKey}` }
        });
        const currentStatus = btcpayRes.data.status;
        if (currentStatus === 'Settled' || currentStatus === 'Paid') {
          await transactionsCollection.updateOne({ invoiceId: transaction.invoiceId }, { $set: { status: 'Paid' } });
          return res.status(200).json({ status: 'completed' });
        }
        return res.status(200).json({ status: 'pending' });
      } catch (btcErr) {
        console.error("Error fetching status from BTCPay:", btcErr.message);
      }
    }

    const isPaid = ["Paid", "Success", "Settled"].includes(transaction.status);
    return res.status(200).json({ status: isPaid ? "completed" : "pending" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ★★★ Vercel এর জন্য Export ★★★
module.exports = app;

// লোকালে চালানোর জন্য
if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server is running smoothly on port ${PORT}`);
    });
  });
}