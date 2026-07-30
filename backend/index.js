require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const QRCode = require('qrcode');
const dns = require('dns');
const axios = require('axios');
const crypto = require('crypto');

// DNS সার্ভার এবং IPv4 প্রিফারেন্স সেটআপ
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const DB_URI = process.env.DB_URI;

// MongoDB 
const client = new MongoClient(DB_URI);
let db, paymentLinksCollection, usersCollection, withdrawalsCollection, transactionsCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('thunder_merchant');
    paymentLinksCollection = db.collection('paymentLinks');
    usersCollection = db.collection('users');
    withdrawalsCollection = db.collection('withdrawals');
    transactionsCollection = db.collection('transactions');
    console.log("MongoDB Native Connected Successfully");

    // (Master Admin Seed)
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

// --- 1. PAYMENT LINKS & CHECKOUT API (Unified & Filtered) ---
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

    // যদি মাস্টার অ্যাডমিন না হয়, তবে শুধু তার নিজের ইমেইলের লিংকগুলো দেখাবে
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

// --- 2. AUTH LOGIN API ---
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

    res.status(200).json({
      success: true,
      message: "Login successful",
      token: "thunder-mock-jwt-token-12345",
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

// --- BTCPAY GATEWAY QR & INVOICE API (CashApp Style Dynamic Generation) ---
app.post('/api/generate-gateway-qr', async (req, res) => {
    try {
        const { 
            linkId, 
            amount, 
            buyerEmail, 
            userEmail, 
            userId, 
            userName,
            currency, 
            orderId 
        } = req.body;

        const btcpayUrl = process.env.BTCPAY_URL;
        const storeId = process.env.BTCPAY_STORE_ID;
        const apiKey = process.env.BTCPAY_API_KEY;

        const frontendDomain = process.env.FRONTEND_URL || "https://cash-app-pay.netlify.app";
        const dynamicLinkId = linkId || 'pay';   // ← ডাইনামিক linkId

        // ========== FALLBACK MODE (BTCPay না থাকলে) ==========
        if (!btcpayUrl || !storeId || !apiKey) {
            const currentOrderId = orderId || 'ORDER-' + Date.now();
            const fallbackInvoiceId = 'FALLBACK-' + Date.now();
            const fallbackLink = `${frontendDomain}/${dynamicLinkId}/i/${fallbackInvoiceId}`;
            
            const qrCodeImageBase64 = await QRCode.toDataURL(fallbackLink);
            
            if (typeof transactionsCollection !== 'undefined' && transactionsCollection) {
                try {
                    await transactionsCollection.insertOne({
                        invoiceId: fallbackInvoiceId,
                        payId: fallbackLink,
                        lnInvoice: fallbackLink,
                        name: `Payment for ${linkId || 'Quick Invoice'}`,
                        amount: Number(amount || 10),
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
                amount: amount || "10.00",
                qrCodeUrl: qrCodeImageBase64,
                bolt11: fallbackLink,
                lightningInvoice: fallbackLink,
                note: "Running on simulated mode because BTCPay env variables are missing."
            });
        }

        // ========== BTCPay MODE ==========
        const normalizedBtcpayUrl = btcpayUrl.endsWith('/') ? btcpayUrl : `${btcpayUrl}/`;
        const endpoint = `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices`;

        const invoiceData = {
            amount: (amount || "10.00").toString(),
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
        
        // ========== ডাইনামিক Checkout Link ==========
        let checkoutLink = `${frontendDomain}/${dynamicLinkId}/i/${invoiceId}`;

        // Lightning Invoice (bolt11) বের করা
        let bolt11Invoice = "";
        try {
            const paymentMethodsRes = await axios.get(
                `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${invoiceId}/payment-methods`, 
                {
                    headers: { 'Authorization': `token ${apiKey}` }
                }
            );
            
            if (paymentMethodsRes && paymentMethodsRes.data) {
                const methods = Array.isArray(paymentMethodsRes.data) 
                    ? paymentMethodsRes.data 
                    : [paymentMethodsRes.data];
                
                const lightningMethod = methods.find(m => 
                    m.paymentMethod === "BTC-LightningNetwork" || 
                    m.paymentMethodId === "BTC-LightningNetwork" ||
                    (m.destination && m.destination.startsWith('lnbc')) ||
                    (m.bolt11 && m.bolt11.startsWith('lnbc'))
                );

                if (lightningMethod) {
                    bolt11Invoice = lightningMethod.destination || lightningMethod.bolt11 || lightningMethod.paymentLink || "";
                } else {
                    const found = methods.find(m => m.destination && m.destination.startsWith('lnbc'));
                    if (found) bolt11Invoice = found.destination;
                }
            }
        } catch (pmErr) {
            console.error("Could not fetch payment methods for bolt11:", pmErr.message);
        }

        if (!bolt11Invoice && invoice.paymentMethods) {
            const lnMethod = invoice.paymentMethods.find(
                m => m.paymentMethod === "BTC-LightningNetwork" || m.paymentMethodId === "BTC-LightningNetwork"
            );
            if (lnMethod) {
                bolt11Invoice = lnMethod.destination || lnMethod.bolt11 || "";
            }
        }

        if (!bolt11Invoice) {
            bolt11Invoice = invoiceId;
        }

        let qrCodeImageBase64 = "";
        try {
            qrCodeImageBase64 = await QRCode.toDataURL(checkoutLink, {
                errorCorrectionLevel: 'M',
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        } catch (qrErr) {
            console.error("QR Code Generation Error:", qrErr.message);
            return res.status(500).json({ success: false, error: "Failed to generate QR Code image" });
        }

        // ========== DATABASE SAVE ==========
        if (typeof transactionsCollection !== 'undefined' && transactionsCollection) {
            try {
                await transactionsCollection.insertOne({
                    invoiceId: invoiceId,
                    payId: bolt11Invoice,      
                    lnInvoice: bolt11Invoice,    
                    name: `Payment for ${linkId || 'Quick Invoice'}`,
                    amount: Number(amount || 10),
                    currency: currency || 'USD',
                    status: "Pending",
                    checkoutLink: checkoutLink,
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
            invoiceId: invoiceId,
            checkoutLink: checkoutLink,
            amount: amount || "10.00",
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
// --- 3. DASHBOARD STATS & BALANCE API ---



app.get('/api/balance', async (req, res) => {
  try {
    const { email, role, userId } = req.query;

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

    const transactions = await transactionsCollection.find(query).toArray();
    const withdrawals = await withdrawalsCollection.find(query).toArray();

    // শুধু Paid ট্রানজেকশন থেকে আয়
    let totalEarnings = 0;
    transactions.forEach(t => {
      const status = (t.status || "").toLowerCase();
      if (status === "paid" || status === "success" || status === "settled") {
        totalEarnings += Number(t.amount || 0);
      }
    });

    // শুধু Paid / Approved withdrawal
    let totalWithdrawn = 0;
    // Pending withdrawal (hold থাকবে)
    let pendingWithdrawn = 0;

    withdrawals.forEach(w => {
      const status = (w.status || "pending").toLowerCase();
      const amt = Number(w.amount || w.originalAmount || 0);

      if (status === "paid" || status === "approved") {
        totalWithdrawn += amt;
      } else if (status === "pending") {
        pendingWithdrawn += amt;
      }
    });

    // Available = আয় - Paid Withdraw - Pending Withdraw
    let currentBalance = totalEarnings - totalWithdrawn - pendingWithdrawn;
    if (currentBalance < 0) currentBalance = 0;

    res.json({
      balance: currentBalance,
      myOwnEarnings: totalEarnings,
      teamTotalEarnings: 0,
      totalEarnings: totalEarnings,
      totalWithdrawn: totalWithdrawn,
      pendingWithdrawn: pendingWithdrawn
    });

  } catch (error) {
    console.error("Failed to fetch balance stats:", error);
    res.status(500).json({ error: "Failed to fetch balance stats" });
  }
});
// --- 4. TRANSACTIONS API ---
app.get('/api/transactions', async (req, res) => {
    try {
        const { userEmail, role, userId } = req.query;

        let query = {};
        const isMasterAdmin = (role === 'master' || role === 'master_admin' || role === 'admin' || userEmail === 'admin@mamun.com');

        if (!isMasterAdmin) {
            let conditions = [];

            // ১. ইমেলের জন্য কন্ডিশন
            if (userEmail) {
                conditions.push({ userEmail: userEmail });
                conditions.push({ email: userEmail });
            }

            // ২. userId স্ট্রিং এবং ObjectId উভয়ভাবেই চেক করা (যাতে ডাটা টাইপ মিসম্যাচ না করে)
            if (userId) {
                conditions.push({ userId: userId }); // স্ট্রিং হিসেবে চেক
                if (ObjectId.isValid(userId)) {
                    conditions.push({ userId: new ObjectId(userId) }); // ObjectId হিসেবে চেক
                }
            }

            if (conditions.length > 0) {
                query = { $or: conditions };
            } else {
                return res.status(400).json({ success: false, error: "User email or ID is required." });
            }
        }

        // ডাটাবেজ থেকে কুয়েরি রান করা
        const transactions = await transactionsCollection.find(query).sort({ createdAt: -1 }).toArray(); 
        
        res.json({
            success: true,
            transactions: transactions
        });
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
                console.warn('⚠️ Invalid Webhook Signature Received!');
                return res.status(400).send('Invalid signature');
            }
        }

        console.log("-----------------------------------------");
        console.log("✅ BTCPay Webhook Received Event Type:", event.type);

        if (event.type === 'InvoiceSettled' || event.type === 'InvoicePaymentSettled') {
            const invoiceId = event.invoiceId;
            const bolt11Invoice = event.bolt11; 

            console.log(`🎉 Payment Settled via Webhook! Invoice ID: ${invoiceId}`);

            if (typeof transactionsCollection !== 'undefined' && transactionsCollection) {
                await transactionsCollection.updateOne(
                    { invoiceId: invoiceId },
                    { 
                        $set: { 
                            status: 'Paid',
                            bolt11: bolt11Invoice || "" 
                        } 
                    }
                );
                console.log(`Database updated to 'Paid' for Invoice ID: ${invoiceId}`);
            }
        }

        console.log("-----------------------------------------");
        res.status(200).json({ received: true });

    } catch (error) {
        console.error("❌ Webhook Error Processing:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- 5. WITHDRAWAL API ---
app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, userName, userEmail, userId, payoutMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
    }

    if (!userEmail) {
      return res.status(400).json({ success: false, message: "User email is required" });
    }

    // বর্তমান ব্যালেন্স চেক (over-request আটকাতে)
    const txQuery = { userEmail: userEmail };
    const transactions = await transactionsCollection.find(txQuery).toArray();
    const withdrawals = await withdrawalsCollection.find(txQuery).toArray();

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
      if (status === "paid" || status === "approved") {
        totalWithdrawn += amt;
      } else if (status === "pending") {
        pendingWithdrawn += amt;
      }
    });

    const available = totalEarnings - totalWithdrawn - pendingWithdrawn;

    if (Number(amount) > available) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient funds. Available: $${available.toFixed(2)}` 
      });
    }

    const withdrawalRecord = {
      userName: userName || "User",
      userEmail: userEmail,
      userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
      amount: Number(amount),
      originalAmount: Number(amount),
      type: "User Payout",
      payoutMethod: payoutMethod || "Bank Transfer",
      status: "Pending",
      requestTime: new Date().toLocaleString(),
      createdAt: new Date()
    };

    await withdrawalsCollection.insertOne(withdrawalRecord);

    res.status(200).json({ 
      success: true, 
      message: "Withdrawal request submitted successfully",
      withdrawnAmount: amount 
    });

  } catch (error) {
    console.error("Withdrawal Error:", error);
    res.status(500).json({ success: false, message: "Server error during withdrawal" });
  }
});
// User Withdrawal History
app.get('/api/my-withdrawals', async (req, res) => {
  try {
    const { userEmail, role } = req.query;
    let query = {};
    const isMasterAdmin = (role === 'master' || role === 'master_admin' || role === 'admin' || userEmail === 'admin@mamun.com');

    if (!isMasterAdmin && userEmail) {
      query = { userEmail: userEmail };
    }

    const withdrawals = await withdrawalsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(withdrawals);

  } catch (error) {
    console.error("Fetch My Withdrawals Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Admin Withdrawal List
app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const withdrawals = await withdrawalsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(withdrawals);

  } catch(error){
    console.error("Fetch Withdrawals Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Admin Update Status
app.put('/api/admin/withdrawals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID"
      });
    }

    const result = await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: status,
          updatedAt: new Date() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found"
      });
    }

    res.json({
      success: true,
      message: `Status updated to ${status}`
    });

  } catch(error){
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// --- 6. USER MANAGEMENT & CRUD API ---
app.get('/api/me', async (req, res) => {
  try {
    res.json({
      name: "Master Mamun",
      email: "admin@mamun.com",
      role: "master_admin"
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const { role, userId } = req.query;
    let query = {};

    if (role === 'master_admin' || role === 'master' || role === 'admin') {
      query = {}; 
    } else if (userId && ObjectId.isValid(userId)) {
      const uId = new ObjectId(userId);
      query = { 
        $or: [
          { _id: uId }, 
          { createdBy: uId }
        ] 
      };
    } else {
      query = {};
    }

    const users = await usersCollection.find(query).project({ password: 0 }).toArray();
    res.status(200).json(users);
  } catch (err) {
    console.error("Fetch Users Error:", err);
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
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists!' });
    }

    let creatorId = createdBy || null;
    if (creatorId && ObjectId.isValid(creatorId)) {
      creatorId = new ObjectId(creatorId);
    }

    const newUser = {
      name,
      email,
      password,
      role: role || 'single',
      whatsapp: whatsapp || '',
      dollarRate: dollarRate !== '' && dollarRate !== undefined ? Number(dollarRate) : 0,
      createdBy: creatorId,
      createdAt: new Date()
    };

    const result = await usersCollection.insertOne(newUser);

    res.status(200).json({ 
      success: true, 
      message: 'User Created Successfully!',
      _id: result.insertedId,
      ...newUser
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, role, whatsapp, dollarRate } = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID!' });
    }

    const updateData = {
      name,
      email,
      role,
      whatsapp,
      dollarRate: dollarRate !== '' && dollarRate !== undefined ? Number(dollarRate) : 0
    };

    if (password && password.trim() !== '') {
      updateData.password = password; 
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }

    res.status(200).json({ success: true, message: 'User Updated Successfully!' });
  } catch (error) {
    console.error("Update User Error:", error);
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

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID format!" });
    }

    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    res.status(200).json({ success: true, message: "User Deleted Successfully!" });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ success: false, message: "Server error while deleting user" });
  }
});

// --- পেমেন্ট লিংক তৈরির রাউট (Create Link) ---
app.post('/api/create-payment-link', async (req, res) => {
  try {
    const { name, url, theme, template, amount, createdAt, userEmail, userId } = req.body;
    
    const selectedTheme = theme || template || 'light';
    const imagePath = selectedTheme === 'green' ? '/src/asset/cashapp_green.png' : '/src/asset/cashapp_light.png';

    const newLink = {
      name,
      url,
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
    console.error("Error creating payment link:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});
app.get('/api/payment-links/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    
    let link = null;
    
    // ১. যদি _id দিয়ে ম্যাচ করে
    if (ObjectId.isValid(linkId)) {
      link = await paymentLinksCollection.findOne({ _id: new ObjectId(linkId) });
    }
    
    // ২. যদি সরাসরি নাম বা ইউআরএলের অংশবিশেষ দিয়ে ম্যাচ করে
    if (!link) {
      link = await paymentLinksCollection.findOne({ 
        $or: [
          { name: linkId },
          { url: { $regex: linkId, $options: 'i' } }
        ]
      });
    }

    if (!link) {
      return res.status(404).json({ success: false, error: "Payment link not found" });
    }

    res.json(link);
  } catch (error) {
    console.error("Error fetching payment link details:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// --- কার্ড আপডেট বা Save করার রাউট (Update Link & Theme) ---
app.put('/api/payment-links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { theme, template, name, url } = req.body;

    console.log("========== THEME UPDATE ==========");
    console.log("ID:", id);
    console.log("Received body:", req.body);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Link ID format!" });
    }

    // theme normalize করা (green / light ছাড়া অন্য কিছু আসলে light করে দিবে)
    let finalTheme = (theme || template || "light").toString().toLowerCase().trim();
    if (finalTheme !== "green") {
      finalTheme = "light";
    }

    const imagePath = finalTheme === "green"
      ? "/src/asset/cashapp_green.png"
      : "/src/asset/cashapp_light.png";

    const updateFields = {
      theme: finalTheme,
      template: finalTheme,
      image: imagePath,
    };

    if (name) updateFields.name = name;
    if (url) updateFields.url = url;

    console.log("Will update with:", updateFields);

    const result = await paymentLinksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "Payment link not found!" });
    }

    console.log("Updated document theme:", result.theme);
    console.log("==================================");

    res.status(200).json({
      success: true,
      message: "Payment link and theme updated successfully!",
      data: result          // আপডেট হওয়া পুরো ডকুমেন্ট ফেরত দিচ্ছি
    });

  } catch (error) {
    console.error("Update Payment Link Error:", error);
    res.status(500).json({ success: false, error: "Server error while updating payment link" });
  }
});
// --- Payment link Crud delete matro master admin parbe  ---
app.delete('/api/payment-links/:id', async (req, res) => {
  try {
    const linkId = req.params.id;

    // ১. আইডি ভ্যালিড কিনা চেক করা
    if (!ObjectId.isValid(linkId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment link id format"
      });
    }

    // ২. Query থেকে বা Body থেকে role এবং email সংগ্রহ করা
    const role = req.query.role || req.body?.role;
    const email = req.query.email || req.body?.email;

    const query = { _id: new ObjectId(linkId) };

    // ৩. মাস্টার অ্যাডমিন বা অ্যাডমিন না হলে শুধুমাত্র নিজের লিংক ডিলিট করতে পারবে
    const isMasterAdmin = (role === 'master' || role === 'master_admin' || role === 'admin' || email === 'admin@mamun.com');

    if (!isMasterAdmin) {
      if (!email) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Email required to delete link"
        });
      }
      // ডাটাবেজে 'email'-এর বদলে সঠিক ফিল্ড 'userEmail' ব্যবহার করা হলো
      query.userEmail = email;
    }

    // ৪. ডাটাবেজ থেকে ডিলিট অপারেশন চালানো
    const result = await paymentLinksCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Payment link not found or you do not have permission to delete it"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment link deleted successfully"
    });

  } catch (error) {
    console.error("Backend Delete Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error"
    });
  }
});


// --- ADMIN / USER PASSWORD UPDATE API ---
app.put('/api/admin/update-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    // ইউজার ডাটাবেজে আছে কি না চেক করা
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }
// পুরোনো পাসওয়ার্ড সঠিক আছে কি না চেক করা
    if (user.password !== oldPassword) {
      return res.status(401).json({ success: false, message: "Incorrect old password!" });
    }
// নতুন পাসওয়ার্ড আপডেট করা
    await usersCollection.updateOne(
      { email: email },
      { $set: { password: newPassword, updatedAt: new Date() } }
    );

    res.status(200).json({ success: true, message: "Password updated successfully!" });

  } catch (error) {
    console.error("Update Password Error:", error);
    res.status(500).json({ success: false, message: "Server error while updating password" });
  }
});

// --- PAYMENT STATUS CHECK API ---
app.get('/i/:linkId/status', async (req, res) => {
  try {
    const { linkId } = req.params;
    const transaction = await transactionsCollection.findOne({ invoiceId: linkId });
    const btcpayUrl = process.env.BTCPAY_URL;
    const storeId = process.env.BTCPAY_STORE_ID;
    const apiKey = process.env.BTCPAY_API_KEY;
    const normalizedBtcpayUrl = btcpayUrl ? (btcpayUrl.endsWith('/') ? btcpayUrl : `${btcpayUrl}/`) : '';
if (!transaction) {
      try {
        const objectIdLink = new ObjectId(linkId);
        const txById = await transactionsCollection.findOne({ _id: objectIdLink });
        if (txById && txById.invoiceId && normalizedBtcpayUrl) {
            const response = await axios.get(`${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${txById.invoiceId}`, {
               headers: { 'Authorization': `token ${apiKey}` }
            });
                return res.status(200).json({
               status: response.data.status 
            });
        }
      } catch (e) {
        // Not a valid ObjectId
      }
      return res.status(404).json({ status: "not_found" });
    }
if (normalizedBtcpayUrl && storeId && apiKey && transaction.invoiceId) {
        try {
            const btcpayRes = await axios.get(`${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${transaction.invoiceId}`, {
                headers: { 'Authorization': `token ${apiKey}` }
            });
             const currentStatus = btcpayRes.data.status; 

            if (currentStatus === 'Settled' || currentStatus === 'Paid') {
                await transactionsCollection.updateOne(
                    { invoiceId: transaction.invoiceId },
                    { $set: { status: 'Paid' } }
                );
                return res.status(200).json({ status: 'completed' });
            } return res.status(200).json({ status: 'pending' });
        } catch (btcErr) {
            console.error("Error fetching status from BTCPay:", btcErr.message);
        }
    }
 const isPaid = transaction.status === "Paid" || transaction.status === "Success" || transaction.status === "Settled";
    return res.status(200).json({
      status: isPaid ? "completed" : "pending"
    });

  } catch (error) {
    console.error("Status Check Error:", error);
    return res.status(500).json({ status: "error", message: `Internal server error: ${error.message}` });
  }
});
// ডাটাবেজ কানেক্ট করে সার্ভার রান করা নিশ্চিত করা হলো
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server is running smoothly on port ${PORT}`);
  });
});