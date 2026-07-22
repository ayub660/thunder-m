require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const QRCode = require('qrcode');
const dns = require('dns');
const axios = require('axios');

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
connectDB();

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

app.get('/api/payment-links/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await paymentLinksCollection.findOne({ name: linkId });
    if (!link) {
      return res.status(404).json({ error: "Payment link not found" });
    }
    res.json(link);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/create-payment-link', async (req, res) => {
  try {
    const { name, url, theme, amount, image, createdAt } = req.body;
    const newLink = {
      name,
      url,
      theme,
      amount,
      image,
      createdAt: createdAt ? new Date(createdAt) : new Date()
    };
    const result = await paymentLinksCollection.insertOne(newLink);
    const savedLink = { _id: result.insertedId, ...newLink };
    res.status(201).json(savedLink);
  } catch (error) {
    res.status(500).json({ error: "Failed to save payment link" });
  }
});

app.put('/api/update-theme/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { theme } = req.body;
    const result = await paymentLinksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { theme } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Link not found" });
    }
    const updatedLink = await paymentLinksCollection.findOne({ _id: new ObjectId(id) });
    res.json({ success: true, updatedLink });
  } catch (error) {
    res.status(500).json({ error: "Failed to update theme" });
  }
});

// --- BTCPAY GATEWAY QR & INVOICE API ---
app.post('/api/generate-gateway-qr', async (req, res) => {
    try {
        const { linkId, amount, buyerEmail, userEmail } = req.body;

        const btcpayUrl = process.env.BTCPAY_URL;
        const storeId = process.env.BTCPAY_STORE_ID;
        const apiKey = process.env.BTCPAY_API_KEY;

        if (!btcpayUrl || !storeId || !apiKey) {
            return res.status(500).json({ success: false, error: "BTCPay environment variables are missing!" });
        }

        const endpoint = `${btcpayUrl}api/v1/stores/${storeId}/invoices`;

        const invoiceData = {
            amount: (amount || "10").toString(),
            currency: 'USD',
            paymentMethods: ["BTC_Lightning"], 
            metadata: {
                linkId: linkId || 'LightningPayment',
                orderId: 'ORDER-' + Date.now(),
            },
            checkout: {
                speedPolicy: "HighSpeed",
                buyerEmail: buyerEmail || "customer@example.com"
            }
        };

        const btcpayResponse = await axios.post(endpoint, invoiceData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const checkoutLink = btcpayResponse.data.checkoutLink;
        const invoiceId = btcpayResponse.data.id;

        const qrCodeImageBase64 = await QRCode.toDataURL(checkoutLink);

        if (transactionsCollection) {
            await transactionsCollection.insertOne({
                invoiceId: invoiceId,
                name: `Payment for ${linkId || 'Gateway'}`,
                amount: Number(amount || 10),
                currency: 'USD',
                status: "Pending",
                checkoutLink: checkoutLink,
                userEmail: userEmail || "admin@mamun.com",
                createdAt: new Date()
            });
        }

        res.status(200).json({
            success: true,
            invoiceId: invoiceId,
            checkoutLink: checkoutLink,
            amount: amount || "10",
            qrCodeUrl: qrCodeImageBase64
        });

    } catch (error) {
        console.error("BTCPay Gateway QR Error:", error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: "Failed to generate BTCPay gateway QR",
            details: error.response?.data || error.message 
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
      if (t.status === "Paid" || t.status === "Success") {
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

app.post("/api/btcpay/webhook", (req, res) => {
    console.log("BTCPay webhook received");
    console.log(req.body);
    res.sendStatus(200);
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

// অ্যাডমিনের জন্য সব উইথড্র রিকোয়েস্ট ফেচ করার রাউট
app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const withdrawals = await withdrawalsCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.status(200).json(withdrawals);
  } catch (error) {
    console.error("Fetch Withdrawals Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// অ্যাডমিনের জন্য উইথড্র স্ট্যাটাস আপডেট (Pending থেকে Paid বা Approved করা) রাউট
app.put('/api/admin/withdrawals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Paid' বা 'Approved'

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

app.post('/api/create-invoice', async (req, res) => {
    try {
        const { amount, currency, orderId, buyerEmail } = req.body;

        const btcpayUrl = process.env.BTCPAY_URL;
        const storeId = process.env.BTCPAY_STORE_ID;
        const apiKey = process.env.BTCPAY_API_KEY;

        if (!btcpayUrl || !storeId || !apiKey) {
            return res.status(500).json({ success: false, message: "BTCPay environment variables are missing!" });
        }

        const endpoint = `${btcpayUrl}api/v1/stores/${storeId}/invoices`;

        const invoiceData = {
            amount: amount ? amount.toString() : "10",
            currency: currency || 'USD',
            metadata: {
                orderId: orderId || 'ORDER-' + Date.now(),
            },
            checkout: {
                speedPolicy: "MediumSpeed",
                buyerEmail: buyerEmail || "customer@example.com"
            }
        };

        const response = await axios.post(endpoint, invoiceData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(201).json({
            success: true,
            invoiceId: response.data.id,
            checkoutLink: response.data.checkoutLink
        });

    } catch (error) {
        console.error('BTCPay Invoice Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create invoice',
            error: error.response?.data || error.message
        });
    }
});

app.put('/api/admin/update-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    if (user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: "Incorrect old password!" });
    }

    await usersCollection.updateOne(
      { email },
      { $set: { password: newPassword } }
    );

    res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ success: false, message: "Server error while updating password" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running smoothly on port ${PORT}`);
});