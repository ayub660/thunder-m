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

// MongoDB কানেকশন সেটআপ
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

    // মাস্টার অ্যাডমিন স্বয়ংক্রিয়ভাবে তৈরি করা (Master Admin Seed)
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

// --- 1. PAYMENT LINKS & CHECKOUT API ---
app.get('/api/payment-links', async (req, res) => {
  try {
    const links = await paymentLinksCollection.find().sort({ createdAt: -1 }).toArray();
    res.json(links);
  } catch (error) {
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

// ইনভয়েস স্ট্যাটাস চেক করার রাউট
app.get('/i/:invoiceId/status', async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // ১. প্রথমে আপনার লোকাল ডাটাবেজে ট্রানজ্যাকশন স্ট্যাটাস চেক করতে পারেন
    if (typeof transactionsCollection !== 'undefined' && transactionsCollection) {
      const localTx = await transactionsCollection.findOne({ invoiceId: invoiceId });
      if (localTx && (localTx.status === 'completed' || localTx.status === 'Paid')) {
        return res.status(200).json({ status: 'completed' });
      }
    }

    // ২. যদি BTCPay Server কনফিগার করা থাকে, তবে সরাসরি BTCPay থেকে রিয়েল-টাইম স্ট্যাটাস এনে চেক করতে পারেন
    const btcpayUrl = process.env.BTCPAY_URL;
    const storeId = process.env.BTCPAY_STORE_ID;
    const apiKey = process.env.BTCPAY_API_KEY;

    if (btcpayUrl && storeId && apiKey) {
      const normalizedBtcpayUrl = btcpayUrl.endsWith('/') ? btcpayUrl : `${btcpayUrl}/`;
      const endpoint = `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${invoiceId}`;

      const btcpayRes = await axios.get(endpoint, {
        headers: { 'Authorization': `token ${apiKey}` }
      });

      if (btcpayRes && btcpayRes.data) {
        const status = btcpayRes.data.status; // সাধারণত 'Settled', 'Complete', 'Paid' ইত্যাদি হতে পারে
        
        // স্ট্যাটাস যদি পেমেন্ট সম্পূর্ণ হওয়া বোঝায়
        if (status === 'Settled' || status === 'Complete' || status === 'Paid') {
          // চাইলে এখানে লোকাল ডাটাবেজ আপডেট করে নিতে পারেন
          if (typeof transactionsCollection !== 'undefined' && transactionsCollection) {
            await transactionsCollection.updateOne(
              { invoiceId: invoiceId },
              { $set: { status: 'completed' } }
            );
          }
          return res.status(200).json({ status: 'completed' });
        }
      }
    }

    // অন্যথায় স্ট্যাটাস পেন্ডিং রিটার্ন করবে
    return res.status(200).json({ status: 'pending' });

  } catch (error) {
    console.error("Error checking invoice status:", error.message);
    res.status(500).json({ status: 'error', error: error.message });
  }
});
// --- BTCPAY GATEWAY QR & INVOICE API (CashApp Style Dynamic Generation) ---
// --- BTCPAY GATEWAY QR & INVOICE API (CashApp Style Dynamic Generation) ---
app.post('/api/generate-gateway-qr', async (req, res) => {
    try {
        const { linkId, amount, buyerEmail, userEmail, currency, orderId } = req.body;

        const btcpayUrl = process.env.BTCPAY_URL;
        const storeId = process.env.BTCPAY_STORE_ID;
        const apiKey = process.env.BTCPAY_API_KEY;

        // যদি BTCPay কনফিগার করা না থাকে, তবে ফলব্যাক QR তৈরি করবে
        if (!btcpayUrl || !storeId || !apiKey) {
            const fallbackLink = `https://pay.example.com/checkout?amount=${amount || '10.00'}&order=${orderId || 'ORDER-' + Date.now()}`;
            const qrCodeImageBase64 = await QRCode.toDataURL(fallbackLink);
            
            return res.status(200).json({
                success: true,
                invoiceId: 'FALLBACK-' + Date.now(),
                checkoutLink: fallbackLink,
                amount: amount || "10.00",
                qrCodeUrl: qrCodeImageBase64,
                bolt11: fallbackLink,
                lightningInvoice: fallbackLink,
                note: "Running on simulated mode because BTCPay env variables are missing."
            });
        }

        const normalizedBtcpayUrl = btcpayUrl.endsWith('/') ? btcpayUrl : `${btcpayUrl}/`;
        const endpoint = `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices`;

        const invoiceData = {
            amount: (amount || "10.00").toString(),
            currency: currency || 'USD',
            paymentMethods: ["BTC-LightningNetwork", "BTC"], 
            metadata: {
                linkId: linkId || 'CashAppStylePayment',
                orderId: orderId || 'ORDER-' + Date.now(),
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
        let checkoutLink = invoice.checkoutLink || `${normalizedBtcpayUrl}i/${invoiceId}`;

        // --- সঠিকভাবে Lightning Invoice (bolt11) বের করার আপডেট করা লজিক ---
        let bolt11Invoice = "";
        try {
            const paymentMethodsRes = await axios.get(`${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${invoiceId}/payment-methods`, {
                headers: { 'Authorization': `token ${apiKey}` }
            });
            
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
                } else {
                    const found = methods.find(m => m.destination && m.destination.startsWith('lnbc'));
                    if (found) bolt11Invoice = found.destination;
                }
            }
        } catch (pmErr) {
            console.error("Could not fetch payment methods for bolt11:", pmErr.message);
        }

        if (!bolt11Invoice && invoice.paymentMethods) {
            const lnMethod = invoice.paymentMethods.find(m => m.paymentMethod === "BTC-LightningNetwork" || m.paymentMethodId === "BTC-LightningNetwork");
            if (lnMethod) {
                bolt11Invoice = lnMethod.destination || lnMethod.bolt11 || "";
            }
        }

        // যদি কোনোভাবেই লাইটনিং স্ট্রিং না পাওয়া যায়, তবে ফলব্যাক হিসেবে ইনভয়েস আইডি বসবে
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

        if (typeof transactionsCollection !== 'undefined' && transactionsCollection) {
            try {
                await transactionsCollection.insertOne({
                    invoiceId: invoiceId,
                    name: `Payment for ${linkId || 'Quick Invoice'}`,
                    amount: Number(amount || 10),
                    currency: currency || 'USD',
                    status: "Pending",
                    checkoutLink: checkoutLink,
                    bolt11: bolt11Invoice,
                    userEmail: userEmail || "admin@mamun.com",
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
            lightningInvoice: bolt11Invoice
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
    const { email, role } = req.query;

    let query = {};
    if (role === 'single' && email) {
      query = { userEmail: email };
    }

    const transactions = await transactionsCollection.find(query).toArray();
    const withdrawals = await withdrawalsCollection.find(query).toArray();

    let totalEarnings = 0;
    transactions.forEach(t => {
      if (t.status === "Paid" || t.status === "Success" || t.status === "Settled") {
        totalEarnings += Number(t.amount || 0);
      }
    });

    let totalWithdrawn = 0;
    withdrawals.forEach(w => {
      totalWithdrawn += Number(w.amount || 0);
    });

    let currentBalance = totalEarnings - totalWithdrawn;
    if (role === 'master_admin' && totalEarnings === 0) {
      currentBalance = 1250;
      totalEarnings = 1250;
    }

    res.json({
      balance: currentBalance,
      myOwnEarnings: totalEarnings,
      teamTotalEarnings: 0,
      totalEarnings: totalEarnings,
      totalWithdrawn: totalWithdrawn
    });

  } catch (error) {
    console.error("Failed to fetch balance stats:", error);
    res.status(500).json({ error: "Failed to fetch balance stats" });
  }
});

// --- 4. TRANSACTIONS API ---
app.get('/api/transactions', async (req, res) => {
    try {
        const transactions = await transactionsCollection.find({}).sort({ createdAt: -1 }).toArray(); 
        res.json({
            success: true,
            transactions: transactions
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Webhook

app.post("/api/btcpay/webhook", async (req, res) => {
    try {
        const event = req.body;
        const btcpaySig = req.headers['btcpay-sig'];
        const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

        // সিকিউরিটি সিগনেচার ভ্যালিডেশন (যদি .env এ সিক্রেট থাকে)
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

        // পেমেন্ট সফল বা সেটেল হলে ডাটাবেজ আপডেট করার লজিক
        if (event.type === 'InvoiceSettled' || event.type === 'InvoicePaymentSettled') {
            const invoiceId = event.invoiceId;
            const bolt11Invoice = event.bolt11; 
            const amount = event.amount;

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

// --- পেমেন্ট লিংক ডিলিট করার রাউট ---
app.delete('/api/payment-links/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Link ID format!" });
    }

    const result = await paymentLinksCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Payment link not found!" });
    }

    res.status(200).json({ success: true, message: "Payment link deleted successfully!" });
  } catch (error) {
    console.error("Delete Payment Link Error:", error);
    res.status(500).json({ success: false, error: "Server error while deleting payment link" });
  }
});

// --- 5. WITHDRAWAL API ---
app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, userName, userEmail, payoutMethod } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
    }

    const withdrawalRecord = {
      userName: userName || "User",
      userEmail: userEmail || "",
      amount: Number(amount),
      originalAmount: Number(amount),
      type: "User Payout",
      payoutMethod: payoutMethod || "Cash",
      status: "Pending",
      requestTime: new Date().toLocaleString(),
      createdAt: new Date()
    };
    await withdrawalsCollection.insertOne(withdrawalRecord);

    const transactionRecord = {
      id: new ObjectId().toString(),
      name: "Withdrawal Request",
      date: new Date().toISOString().split('T')[0],
      amount: Number(amount),
      status: "Pending",
      createdAt: new Date()
    };
    await transactionsCollection.insertOne(transactionRecord);

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

app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const withdrawals = await withdrawalsCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.status(200).json(withdrawals);
  } catch (error) {
    console.error("Fetch Withdrawals Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/withdrawals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const result = await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: status } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    res.status(200).json({ success: true, message: `Status updated to ${status} successfully!` });
  } catch (error) {
    console.error("Update Withdrawal Status Error:", error);
    res.status(500).json({ success: false, message: error.message });
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

    if (role === 'master_admin') {
      query = {}; 
    } else if (role === 'team_leader') {
      let uId = userId;
      if (userId && ObjectId.isValid(userId)) {
        uId = new ObjectId(userId);
      }
      query = { $or: [{ createdBy: uId }, { _id: uId }] };
    } else {
      let uId = userId;
      if (userId && ObjectId.isValid(userId)) {
        uId = new ObjectId(userId);
      }
      query = { _id: uId };
    }

    const users = await usersCollection.find(query).toArray();
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


// --- নতুন পেমেন্ট লিংক তৈরির রাউট (Create Link) ---
app.post('/api/create-payment-link', async (req, res) => {
  try {
    const { name, url, theme, amount, createdAt } = req.body;
    
    const selectedTheme = theme || 'light';
    const imagePath = selectedTheme === 'green' ? '/src/asset/cashapp_green.png' : '/src/asset/cashapp_light.png';

    const newLink = {
      name,
      url,
      theme: selectedTheme,
      amount,
      image: imagePath, // ব্যাকএন্ড থেকে থিম অনুযায়ী সঠিক ইমেজ সেট করা হলো
      createdAt: createdAt || new Date()
    };

    const result = await paymentLinksCollection.insertOne(newLink);
    res.status(201).json({ _id: result.insertedId, ...newLink });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});
// --- কার্ড আপডেট বা Save করার রাউট (Update Link & Theme) ---
app.put('/api/payment-links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { theme, image, name, url } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Link ID format!" });
    }

    // ডাটাবেজে theme এবং image আপডেট করা হচ্ছে
    const result = await paymentLinksCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          theme: theme, 
          image: image,
          name: name,
          url: url
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Payment link not found!" });
    }

    res.status(200).json({ success: true, message: "Payment link and theme updated successfully!" });
  } catch (error) {
    console.error("Update Payment Link Error:", error);
    res.status(500).json({ success: false, error: "Server error while updating payment link" });
  }
});

// --- ডিলিট রাউট (যদি না থাকে) ---
app.delete('/api/payment-links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await paymentLinksCollection.deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete" });
  }
});

// --- নির্দিষ্ট পেমেন্ট লিংকের ডিটেইলস আনার রাউট ---
app.get('/api/payment-links/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    let link = await paymentLinksCollection.findOne({ name: name });

    if (!link && ObjectId.isValid(name)) {
      link = await paymentLinksCollection.findOne({ _id: new ObjectId(name) });
    }

    if (!link) {
      return res.status(404).json({ success: false, message: "Payment link not found" });
    }

    res.status(200).json(link);
  } catch (error) {
    console.error("Error fetching single payment link:", error);
    res.status(500).json({ success: false, error: "Server error while fetching link" });
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
            }

            return res.status(200).json({ status: 'pending' });
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
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ডাটাবেজ কানেক্ট করে সার্ভার রান করা নিশ্চিত করা হলো
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server is running smoothly on port ${PORT}`);
  });
});