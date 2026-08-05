require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const QRCode = require('qrcode');
const dns = require('dns');
const axios = require('axios');
const crypto = require('crypto');

dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const DB_URI = process.env.DB_URI;

const client = new MongoClient(DB_URI);
let db, paymentLinksCollection, usersCollection, withdrawalsCollection, transactionsCollection;

const isPaidStatus = (status) => {
  const s = (status || '').toLowerCase();
  return s === 'paid' || s === 'success' || s === 'settled' || s === 'completed';
};

const isMaster = (role, email) =>
  role === 'master' ||
  role === 'master_admin' ||
  role === 'admin' ||
  email === 'admin@mamun.com';

async function connectDB() {
  try {
    await client.connect();
    db = client.db('thunder_merchant');
    paymentLinksCollection = db.collection('paymentLinks');
    usersCollection = db.collection('users');
    withdrawalsCollection = db.collection('withdrawals');
    transactionsCollection = db.collection('transactions');
    console.log('MongoDB Native Connected Successfully');

    const masterEmail = 'admin@mamun.com';
    const adminExists = await usersCollection.findOne({ email: masterEmail });
    if (!adminExists) {
      await usersCollection.insertOne({
        name: 'Master Mamun',
        email: masterEmail,
        password: 'admin123',
        role: 'master_admin',
        whatsapp: '',
        totalTransactions: '$0.00',
        transactionCount: 0,
        createdAt: new Date()
      });
      console.log('Default Master Admin Created: admin@mamun.com / admin123');
    }
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
  }
}

// ========== PAYMENT LINKS ==========
app.get('/api/payment-links', async (req, res) => {
  try {
    const { email, role } = req.query;
    let query = {};
    if (!isMaster(role, email) && email) query = { userEmail: email };
    const links = await paymentLinksCollection.find(query).toArray();
    res.json(links);
  } catch (error) {
    console.error('Error fetching payment links:', error);
    res.status(500).json({ error: 'Failed to fetch payment links' });
  }
});

app.post('/api/create-payment-link', async (req, res) => {
  try {
    const { name, url, theme, template, amount, createdAt, userEmail, userId } = req.body;
    const selectedTheme = theme || template || 'light';
    const imagePath =
      selectedTheme === 'green' ? '/src/asset/cashapp_green.png' : '/src/asset/cashapp_light.png';

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
    console.error('Error creating payment link:', error);
    res.status(500).json({ success: false, error: 'Server error' });
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
    if (!link) return res.status(404).json({ success: false, error: 'Payment link not found' });
    res.json(link);
  } catch (error) {
    console.error('Error fetching payment link details:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/payment-links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { theme, template, name, url } = req.body;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Link ID format!' });
    }

    let finalTheme = (theme || template || 'light').toString().toLowerCase().trim();
    if (finalTheme !== 'green') finalTheme = 'light';

    const imagePath =
      finalTheme === 'green' ? '/src/asset/cashapp_green.png' : '/src/asset/cashapp_light.png';

    const updateFields = { theme: finalTheme, template: finalTheme, image: imagePath };
    if (name) updateFields.name = name;
    if (url) updateFields.url = url;

    const result = await paymentLinksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Payment link not found!' });

    res.status(200).json({
      success: true,
      message: 'Payment link and theme updated successfully!',
      data: result
    });
  } catch (error) {
    console.error('Update Payment Link Error:', error);
    res.status(500).json({ success: false, error: 'Server error while updating payment link' });
  }
});

app.delete('/api/payment-links/:id', async (req, res) => {
  try {
    const linkId = req.params.id;
    if (!ObjectId.isValid(linkId)) {
      return res.status(400).json({ success: false, error: 'Invalid payment link id format' });
    }

    const role = req.query.role || req.body?.role;
    const email = req.query.email || req.body?.email;
    const query = { _id: new ObjectId(linkId) };

    if (!isMaster(role, email)) {
      if (!email) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Email required to delete link' });
      }
      query.userEmail = email;
    }

    const result = await paymentLinksCollection.deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment link not found or you do not have permission to delete it'
      });
    }
    res.status(200).json({ success: true, message: 'Payment link deleted successfully' });
  } catch (error) {
    console.error('Backend Delete Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

// ========== AUTH ==========
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required!' });
    }
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found!' });
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid password!' });
    }
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: 'thunder-mock-jwt-token-12345',
      userInfo: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsapp: user.whatsapp || ''
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ========== GENERATE QR ==========
app.post('/api/generate-gateway-qr', async (req, res) => {
  try {
    const { linkId, amount, buyerEmail, userEmail, userId, userName, currency, orderId } = req.body;
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
    const frontendDomain = process.env.FRONTEND_URL || 'https://cash-app-pay.netlify.app';
    const dynamicLinkId = linkId || 'pay';

    if (!btcpayUrl || !storeId || !apiKey) {
      const fallbackInvoiceId = 'FALLBACK-' + Date.now();
      const fallbackLink = `${frontendDomain}/${dynamicLinkId}/i/${fallbackInvoiceId}`;
      const qrCodeImageBase64 = await QRCode.toDataURL(fallbackLink);

      try {
        await transactionsCollection.insertOne({
          invoiceId: fallbackInvoiceId,
          payId: fallbackLink,
          lnInvoice: fallbackLink,
          name: `Payment for ${linkId || 'Quick Invoice'}`,
          amount: finalAmountNumber,
          currency: currency || 'USD',
          status: 'Pending',
          checkoutLink: fallbackLink,
          bolt11: fallbackLink,
          userEmail: userEmail || null,
          userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
          userName: userName || null,
          linkId: linkId || null,
          createdAt: new Date()
        });
      } catch (dbErr) {
        console.error('Fallback DB Insert Error:', dbErr.message);
      }

      return res.status(200).json({
        success: true,
        invoiceId: fallbackInvoiceId,
        checkoutLink: fallbackLink,
        amount: finalAmount,
        qrCodeUrl: qrCodeImageBase64,
        bolt11: fallbackLink,
        lightningInvoice: fallbackLink,
        note: 'Running on simulated mode because BTCPay env variables are missing.'
      });
    }

    const normalizedBtcpayUrl = btcpayUrl.endsWith('/') ? btcpayUrl : `${btcpayUrl}/`;
    const endpoint = `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices`;
    const invoiceData = {
      amount: finalAmount,
      currency: currency || 'USD',
      paymentMethods: ['BTC-LightningNetwork', 'BTC'],
      metadata: {
        linkId: linkId || 'CashAppStylePayment',
        orderId: orderId || 'ORDER-' + Date.now(),
        userEmail: userEmail || null
      },
      checkout: {
        speedPolicy: 'HighSpeed',
        buyerEmail: buyerEmail || 'customer@example.com',
        redirectAutomatically: false
      }
    };

    let btcpayResponse;
    try {
      btcpayResponse = await axios.post(endpoint, invoiceData, {
        headers: { Authorization: `token ${apiKey}`, 'Content-Type': 'application/json' }
      });
    } catch (btcpayErr) {
      console.error('BTCPay API Rejection Error:', btcpayErr.response?.data || btcpayErr.message);
      return res.status(500).json({
        success: false,
        error: btcpayErr.response?.data?.message || `BTCPay Error: ${btcpayErr.message}`
      });
    }

    const invoice = btcpayResponse.data;
    const invoiceId = invoice.id;
    const checkoutLink = `${frontendDomain}/${dynamicLinkId}/i/${invoiceId}`;
    let bolt11Invoice = '';

    try {
      const paymentMethodsRes = await axios.get(
        `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${invoiceId}/payment-methods`,
        { headers: { Authorization: `token ${apiKey}` } }
      );
      if (paymentMethodsRes?.data) {
        const methods = Array.isArray(paymentMethodsRes.data)
          ? paymentMethodsRes.data
          : [paymentMethodsRes.data];
        const lightningMethod = methods.find(
          (m) =>
            m.paymentMethod === 'BTC-LightningNetwork' ||
            m.paymentMethodId === 'BTC-LightningNetwork' ||
            (m.destination && m.destination.startsWith('lnbc')) ||
            (m.bolt11 && m.bolt11.startsWith('lnbc'))
        );
        if (lightningMethod) {
          bolt11Invoice =
            lightningMethod.destination || lightningMethod.bolt11 || lightningMethod.paymentLink || '';
        } else {
          const found = methods.find((m) => m.destination && m.destination.startsWith('lnbc'));
          if (found) bolt11Invoice = found.destination;
        }
      }
    } catch (pmErr) {
      console.error('Could not fetch payment methods for bolt11:', pmErr.message);
    }

    if (!bolt11Invoice && invoice.paymentMethods) {
      const lnMethod = invoice.paymentMethods.find(
        (m) => m.paymentMethod === 'BTC-LightningNetwork' || m.paymentMethodId === 'BTC-LightningNetwork'
      );
      if (lnMethod) bolt11Invoice = lnMethod.destination || lnMethod.bolt11 || '';
    }
    if (!bolt11Invoice) bolt11Invoice = invoiceId;

    let qrCodeImageBase64 = '';
    try {
      qrCodeImageBase64 = await QRCode.toDataURL(checkoutLink, {
        errorCorrectionLevel: 'M',
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (qrErr) {
      console.error('QR Code Generation Error:', qrErr.message);
      return res.status(500).json({ success: false, error: 'Failed to generate QR Code image' });
    }

    try {
      await transactionsCollection.insertOne({
        invoiceId,
        payId: bolt11Invoice,
        lnInvoice: bolt11Invoice,
        name: `Payment for ${linkId || 'Quick Invoice'}`,
        amount: finalAmountNumber,
        currency: currency || 'USD',
        status: 'Pending',
        checkoutLink,
        bolt11: bolt11Invoice,
        userEmail: userEmail || null,
        userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
        userName: userName || null,
        linkId: linkId || null,
        createdAt: new Date()
      });
    } catch (dbErr) {
      console.error('Database Insert Error:', dbErr.message);
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
    console.error('Unexpected Server Crash in /api/generate-gateway-qr:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error occurred while generating gateway QR'
    });
  }
});



// ========== BALANCE ==========
app.get('/api/balance', async (req, res) => {
  try {
    const { email, role, userId } = req.query;
    
    const normalizedRole = (role || '').toString().toLowerCase().trim();
    const isMasterUser = isMaster(normalizedRole, email);

    const isPaid = (status) => {
      const s = (status || '').toString().toLowerCase().trim();
      return ['paid', 'success', 'successful', 'completed', 'approved', 'settled', 'confirmed'].includes(s);
    };

    // ===== MY OWN =====
    const myTxQuery = email
      ? {
          $or: [
            { userEmail: email },
            { email: email },
            ...(userId
              ? [
                  { userId },
                  ...(ObjectId.isValid(userId) ? [{ userId: new ObjectId(userId) }] : [])
                ]
              : [])
          ]
        }
      : { _id: null };

    const myTransactions = email
      ? await transactionsCollection.find(myTxQuery).toArray()
      : [];
    const myWithdrawals = email
      ? await withdrawalsCollection.find({
          $or: [{ userEmail: email }, { email: email }]
        }).toArray()
      : [];

    let myOwnEarnings = 0;
    myTransactions.forEach((t) => {
      if (isPaid(t.status)) myOwnEarnings += Number(t.amount || 0);
    });

    let myWithdrawn = 0;
    let myPending = 0;
    myWithdrawals.forEach((w) => {
      const st = (w.status || 'pending').toLowerCase().trim();
      const amt = Number(w.amount || w.originalAmount || 0);

      if (['paid', 'approved', 'success', 'successful', 'completed', 'settled', 'confirmed'].includes(st)) {
        myWithdrawn += amt;
      } else {
        myPending += amt;
      }
    });

    let myBalance = myOwnEarnings - myWithdrawn - myPending;
    if (myBalance < 0) myBalance = 0;

    // ===== TEAM scope =====
    let teamEmails = [];

    if (isMasterUser) {
      const allUsers = await usersCollection.find({}).project({ email: 1 }).toArray();
      teamEmails = allUsers.map((u) => u.email).filter(Boolean);
    } else if (normalizedRole === 'team_leader') {
      let leaderId = null;
      let leaderIdStr = null;

      if (userId && ObjectId.isValid(userId)) {
        leaderId = new ObjectId(userId);
        leaderIdStr = userId.toString();
      } else if (email) {
        const leader = await usersCollection.findOne({ email });
        if (leader) {
          leaderId = leader._id;
          leaderIdStr = leader._id.toString();
        }
      }

      if (leaderId || leaderIdStr) {
        const teamUsers = await usersCollection
          .find({
            $or: [
              { createdBy: leaderId },
              { createdBy: leaderIdStr },
              ...(leaderIdStr && ObjectId.isValid(leaderIdStr)
                ? [{ createdBy: new ObjectId(leaderIdStr) }]
                : [])
            ]
          })
          .project({ email: 1 })
          .toArray();

        teamEmails = teamUsers.map((u) => u.email).filter(Boolean);
      }
    }

    let teamTotalEarnings = 0;
    let teamWithdrawn = 0;
    let teamPending = 0;
    let totalBillable = 0;
    let totalSettled = 0;

    if (teamEmails.length > 0 || isMasterUser) {
      const teamTxQuery = isMasterUser
        ? {}
        : {
            $or: [
              { userEmail: { $in: teamEmails } },
              { email: { $in: teamEmails } }
            ]
          };

      const teamWdQuery = isMasterUser
        ? {}
        : {
            $or: [
              { userEmail: { $in: teamEmails } },
              { email: { $in: teamEmails } }
            ]
          };

      const teamTx = await transactionsCollection.find(teamTxQuery).toArray();
      const teamWd = await withdrawalsCollection.find(teamWdQuery).toArray();

      teamTx.forEach((t) => {
        const amt = Number(t.amount || 0);

        if (isPaid(t.status)) {
          teamTotalEarnings += amt;
          totalSettled += 1;
        } else {
          totalBillable += amt;
        }
      });

      teamWd.forEach((w) => {
        const st = (w.status || 'pending').toLowerCase().trim();
        const amt = Number(w.amount || w.originalAmount || 0);

        if (['paid', 'approved', 'success', 'successful', 'completed', 'settled', 'confirmed'].includes(st)) {
          teamWithdrawn += amt;
        } else {
          teamPending += amt;
        }
      });
    }

    // ★ AVAILABLE TEAM BALANCE (শুধু টিমের earnings - টিমের withdrawn - টিমের pending)
    let availableTeamBalance = teamTotalEarnings - teamWithdrawn - teamPending;

 
    if (availableTeamBalance < 0) availableTeamBalance = 0;

    // ========== Debug ==========
    console.log('========== BALANCE DEBUG ==========');
    console.log('Role:', normalizedRole);
    console.log('Email:', email);
    console.log('Team Members Found:', teamEmails.length);
    console.log('Team Emails:', teamEmails);
    console.log('teamTotalEarnings:', teamTotalEarnings);
    console.log('teamWithdrawn:', teamWithdrawn);
    console.log('teamPending:', teamPending);
    console.log('myWithdrawn (Leader own):', myWithdrawn);
    console.log('myPending (Leader own):', myPending);
    console.log('Final availableTeamBalance:', availableTeamBalance);
    console.log('===================================');
    // ========== Debug End ==========

    // ★★★ MASTER ADMIN এর জন্য ★★★
    if (isMasterUser) {
      totalBillable = availableTeamBalance;
    }

    const totalEarnings = isMasterUser
      ? teamTotalEarnings
      : myOwnEarnings + teamTotalEarnings;

    const totalWithdrawn = isMasterUser
      ? teamWithdrawn
      : myWithdrawn + teamWithdrawn;

    res.json({
      balance: myBalance,
      availableTeamBalance,
      totalBillable,
      totalSettled,
      myOwnEarnings,
      teamTotalEarnings,
      totalEarnings,
      totalWithdrawn,
      pendingWithdrawn: myPending
    });
  } catch (error) {
    console.error('Failed to fetch balance stats:', error);
    res.status(500).json({ error: 'Failed to fetch balance stats' });
  }
});
// ========== TRANSACTIONS ==========
app.get('/api/transactions', async (req, res) => {
  try {
    const { userEmail, role, userId } = req.query;
    let query = {};

    if (isMaster(role, userEmail)) {
     
      query = {};
    } else if (role === 'team_leader') {
      
      let leaderId = null;
      let leaderIdStr = null;

      if (userId && ObjectId.isValid(userId)) {
        leaderId = new ObjectId(userId);
        leaderIdStr = userId.toString();
      } else if (userEmail) {
        const leader = await usersCollection.findOne({ email: userEmail });
        if (leader) {
          leaderId = leader._id;
          leaderIdStr = leader._id.toString();
        }
      }

      const conditions = [];

      // My own transaction
      if (userEmail) {
        conditions.push({ userEmail });
        conditions.push({ email: userEmail });
      }

      // Under-Er  userder trasaction
      if (leaderId || leaderIdStr) {
        const teamUsers = await usersCollection
          .find({
            $or: [
              { createdBy: leaderId },
              { createdBy: leaderIdStr },
              ...(leaderIdStr && ObjectId.isValid(leaderIdStr)
                ? [{ createdBy: new ObjectId(leaderIdStr) }]
                : [])
            ]
          })
          .project({ email: 1 })
          .toArray();

        const teamEmails = teamUsers.map((u) => u.email).filter(Boolean);

        if (teamEmails.length > 0) {
          conditions.push({ userEmail: { $in: teamEmails } });
          conditions.push({ email: { $in: teamEmails } });
        }
      }

      if (conditions.length === 0) {
        return res.status(400).json({ success: false, error: 'User email or ID is required.' });
      }

      query = { $or: conditions };
    } else {
      // সাধারণ user
      const conditions = [];
      if (userEmail) {
        conditions.push({ userEmail });
        conditions.push({ email: userEmail });
      }
      if (userId) {
        conditions.push({ userId });
        if (ObjectId.isValid(userId)) conditions.push({ userId: new ObjectId(userId) });
      }
      if (conditions.length === 0) {
        return res.status(400).json({ success: false, error: 'User email or ID is required.' });
      }
      query = { $or: conditions };
    }

    const transactions = await transactionsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/transactions/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const tx = await transactionsCollection.findOne({ invoiceId });
    if (!tx) return res.status(404).json({ success: false, error: 'Invoice not found' });

    let qrCodeUrl = tx.qrCodeUrl || null;
    if (!qrCodeUrl && tx.checkoutLink) {
      try {
        qrCodeUrl = await QRCode.toDataURL(tx.checkoutLink, { errorCorrectionLevel: 'M', margin: 2 });
      } catch (e) {
        console.error('QR regen error:', e.message);
      }
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
    console.error('Get transaction error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ========== WEBHOOK ==========
app.post('/api/btcpay/webhook', async (req, res) => {
  try {
    const event = req.body;
    const btcpaySig = req.headers['btcpay-sig'];
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    if (WEBHOOK_SECRET && btcpaySig) {
      const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
      const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
      if (btcpaySig !== digest) {
        console.warn('Invalid Webhook Signature Received!');
        return res.status(400).send('Invalid signature');
      }
    }

    if (event.type === 'InvoiceSettled' || event.type === 'InvoicePaymentSettled') {
      const invoiceId = event.invoiceId;
      await transactionsCollection.updateOne(
        { invoiceId },
        { $set: { status: 'Paid', bolt11: event.bolt11 || '' } }
      );
      console.log(`Database updated to Paid for Invoice ID: ${invoiceId}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook Error Processing:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ========== WITHDRAW ==========
app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, userEmail, userName, userId, payoutMethod } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }
    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'User email is required' });
    }

    const isPaid = (status) => {
      const s = (status || '').toString().toLowerCase().trim();
      return ['paid', 'success', 'successful', 'completed', 'approved', 'settled', 'confirmed'].includes(s);
    };

    // User-এর role বের করা
    let userRole = '';
    let leaderId = null;
    let leaderIdStr = null;

    if (userId && ObjectId.isValid(userId)) {
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (user) {
        userRole = (user.role || '').toString().toLowerCase().trim();
        leaderId = user._id;
        leaderIdStr = user._id.toString();
      }
    } else {
      const user = await usersCollection.findOne({ email: userEmail });
      if (user) {
        userRole = (user.role || '').toString().toLowerCase().trim();
        leaderId = user._id;
        leaderIdStr = user._id.toString();
      }
    }

    const isTeamLeader = userRole === 'team_leader';

    let available = 0;

    if (isTeamLeader && (leaderId || leaderIdStr)) {
      // ========== TEAM LEADER → Team Balance হিসাব ==========
      const teamUsers = await usersCollection
        .find({
          $or: [
            { createdBy: leaderId },
            { createdBy: leaderIdStr },
            ...(leaderIdStr && ObjectId.isValid(leaderIdStr)
              ? [{ createdBy: new ObjectId(leaderIdStr) }]
              : [])
          ]
        })
        .project({ email: 1 })
        .toArray();

      const teamEmails = teamUsers.map((u) => u.email).filter(Boolean);

      const teamTx = await transactionsCollection
        .find({
          $or: [
            { userEmail: { $in: teamEmails } },
            { email: { $in: teamEmails } }
          ]
        })
        .toArray();

      const teamWd = await withdrawalsCollection
        .find({
          $or: [
            { userEmail: { $in: teamEmails } },
            { email: { $in: teamEmails } }
          ]
        })
        .toArray();

      let teamTotalEarnings = 0;
      teamTx.forEach((t) => {
        if (isPaid(t.status)) teamTotalEarnings += Number(t.amount || 0);
      });

      let teamWithdrawn = 0;
      let teamPending = 0;
      teamWd.forEach((w) => {
        const st = (w.status || 'pending').toLowerCase().trim();
        const amt = Number(w.amount || w.originalAmount || 0);
        if (['paid', 'approved', 'success', 'successful', 'completed', 'settled', 'confirmed'].includes(st)) {
          teamWithdrawn += amt;
        } else {
          teamPending += amt;
        }
      });

      available = teamTotalEarnings - teamWithdrawn - teamPending;
      if (available < 0) available = 0;

    } else {
     
      const txQuery = {
        $or: [
          { userEmail },
          { email: userEmail },
          ...(userId
            ? [
                { userId },
                ...(ObjectId.isValid(userId) ? [{ userId: new ObjectId(userId) }] : [])
              ]
            : [])
        ]
      };

      const transactions = await transactionsCollection.find(txQuery).toArray();
      const withdrawals = await withdrawalsCollection
        .find({ $or: [{ userEmail }, { email: userEmail }] })
        .toArray();

      let totalEarnings = 0;
      transactions.forEach((t) => {
        if (isPaid(t.status)) totalEarnings += Number(t.amount || 0);
      });

      let totalWithdrawn = 0;
      let pendingWithdrawn = 0;
      withdrawals.forEach((w) => {
        const st = (w.status || 'pending').toLowerCase();
        const amt = Number(w.amount || w.originalAmount || 0);
        if (st === 'paid' || st === 'approved') totalWithdrawn += amt;
        else if (st === 'pending') pendingWithdrawn += amt;
      });

      available = totalEarnings - totalWithdrawn - pendingWithdrawn;
      if (available < 0) available = 0;
    }

    console.log('=== WITHDRAW DEBUG ===');
    console.log({
      userEmail,
      userRole,
      isTeamLeader,
      available,
      requested: amount
    });

    if (Number(amount) > available) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Available: $${available.toFixed(2)}`
      });
    }

    //  withdrawal request  — balance 
    await withdrawalsCollection.insertOne({
      userName: userName || 'User',
      userEmail,
      userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
      amount: Number(amount),
      originalAmount: Number(amount),
      type: 'User Payout',
      payoutMethod: payoutMethod || 'Bank Transfer',
      status: 'Pending',
      requestTime: new Date().toLocaleString(),
      createdAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawnAmount: Number(amount),
      availableAfter: available - Number(amount)
    });
  } catch (err) {
    console.error('Withdrawal Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});
app.post('/api/withdrawals', async (req, res) => {
  try {
    const { userId, amount, email, name, userEmail, userName, payoutMethod } = req.body;
    const finalEmail = email || userEmail;
    const finalName = name || userName || 'User';
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }
    if (!finalEmail) {
      return res.status(400).json({ success: false, message: 'User email is required' });
    }

    // 1. User khoja
    let user = null;
    if (userId && ObjectId.isValid(userId)) {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    }
    if (!user) user = await usersCollection.findOne({ email: finalEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    
    let emailsToCheck = [user.email];

  
    if (user.role === 'team_leader') {
      const workers = await usersCollection.find({
        createdBy: user._id
      }).toArray();

      const workerEmails = workers.map(w => w.email).filter(Boolean);
      emailsToCheck = [...emailsToCheck, ...workerEmails];
    }

    // 3. Transactions ও Withdrawals 
    const txQuery = { userEmail: { $in: emailsToCheck } };
    const transactions = await transactionsCollection.find(txQuery).toArray();
    const withdrawals = await withdrawalsCollection.find(txQuery).toArray();

    // 4. Available Balance হিসাব
    let totalEarnings = 0;
    transactions.forEach((t) => {
      if (isPaidStatus(t.status)) {
        totalEarnings += Number(t.amount || 0);
      }
    });

    let totalWithdrawn = 0;
    let pendingWithdrawn = 0;
    withdrawals.forEach((w) => {
      const status = (w.status || 'pending').toLowerCase();
      const amt = Number(w.amount || w.originalAmount || 0);

      if (status === 'paid' || status === 'approved') {
        totalWithdrawn += amt;
      } else if (status === 'pending') {
        pendingWithdrawn += amt;
      }
    });

    const available = totalEarnings - totalWithdrawn - pendingWithdrawn;

    if (withdrawAmount > available) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Available: $${available.toFixed(2)}`
      });
    }

    // 5. Withdrawal Request  Save 
    await withdrawalsCollection.insertOne({
      userName: finalName,
      userEmail: user.email,
      userId: user._id,
      amount: withdrawAmount,
      originalAmount: withdrawAmount,
      type: 'Admin Payout',
      payoutMethod: payoutMethod || 'Admin Payout',
      status: 'Pending',
      requestTime: new Date().toLocaleString(),
      createdAt: new Date(),
      
      calculatedFromEmails: emailsToCheck
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal request sent successfully',
      withdrawnAmount: withdrawAmount,
      availableBefore: available
    });

  } catch (err) {
    console.error('POST /api/withdrawals Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

app.get('/api/my-withdrawals', async (req, res) => {
  try {
    const { userEmail, role, userId } = req.query;
    const normalizedRole = (role || '').toString().toLowerCase().trim();
    const isMasterUser = isMaster(normalizedRole, userEmail);

    let query = {};

    if (isMasterUser) {
      // Master Admin → Team Leader  request
      const teamLeaders = await usersCollection.find({
        role: { $regex: /^team_leader$/i }
      }).project({ email: 1 }).toArray();

      const myCreatedUsers = await usersCollection.find({
        $or: [
          { createdBy: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null },
          { createdBy: userId },
          { createdBy: userEmail }
        ]
      }).project({ email: 1 }).toArray();

      const allowedEmails = [
        ...teamLeaders.map(u => u.email),
        ...myCreatedUsers.map(u => u.email)
      ].filter(Boolean);

      query = { userEmail: { $in: allowedEmails } };

    } else if (normalizedRole === 'team_leader') {
      // Team Leader →request
      let leaderId = null;
      if (userId && ObjectId.isValid(userId)) {
        leaderId = new ObjectId(userId);
      } else if (userEmail) {
        const leader = await usersCollection.findOne({ email: userEmail });
        if (leader) leaderId = leader._id;
      }

      const myTeam = await usersCollection.find({
        $or: [
          { createdBy: leaderId },
          { createdBy: userId },
          { createdBy: leaderId?.toString() }
        ]
      }).project({ email: 1 }).toArray();

      const teamEmails = myTeam.map(u => u.email).filter(Boolean);
      query = { userEmail: { $in: teamEmails } };

    } else {
      // Sadaron user  → shudu   nijer
      if (userEmail) query = { userEmail };
    }

    const withdrawals = await withdrawalsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json(withdrawals);
  } catch (error) {
    console.error('Fetch My Withdrawals Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const { email, role, userId } = req.query;
    const normalizedRole = (role || '').toString().toLowerCase().trim();
    const isMasterUser = isMaster(normalizedRole, email);

    let query = {};

    if (isMasterUser) {
      // Master Admin → Team Leader + Own create single user
      const teamLeaders = await usersCollection.find({
        role: { $regex: /^team_leader$/i }
      }).project({ email: 1 }).toArray();

      const myCreatedUsers = await usersCollection.find({
        $or: [
          { createdBy: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null },
          { createdBy: userId },
          { createdBy: email }
        ]
      }).project({ email: 1 }).toArray();

      const allowedEmails = [
        ...teamLeaders.map(u => u.email),
        ...myCreatedUsers.map(u => u.email)
      ].filter(Boolean);

      query = { userEmail: { $in: [...new Set(allowedEmails)] } };

    } else if (normalizedRole === 'team_leader') {
      // Team Leader →Er user
      let leaderId = null;
      if (userId && ObjectId.isValid(userId)) {
        leaderId = new ObjectId(userId);
      } else if (email) {
        const leader = await usersCollection.findOne({ email });
        if (leader) leaderId = leader._id;
      }

      const myTeam = await usersCollection.find({
        $or: [
          { createdBy: leaderId },
          { createdBy: userId },
          { createdBy: leaderId?.toString() }
        ]
      }).project({ email: 1 }).toArray();

      const teamEmails = myTeam.map(u => u.email).filter(Boolean);
      query = { userEmail: { $in: teamEmails } };

    } else {
      
      query = { _id: null };
    }

    const withdrawals = await withdrawalsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json(withdrawals);
  } catch (error) {
    console.error('Fetch Withdrawals Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/withdrawals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { email, role, userId } = req.query; 

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const withdrawal = await withdrawalsCollection.findOne({ _id: new ObjectId(id) });
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    const normalizedRole = (role || '').toString().toLowerCase().trim();
    const isMasterUser = isMaster(normalizedRole, email);

    // ===== Permission check =====
    let hasPermission = false;

    if (isMasterUser) {
      // Master Admin → Team Leader 
      const requester = await usersCollection.findOne({ email: withdrawal.userEmail });
      if (requester) {
        const isTeamLeader = (requester.role || '').toLowerCase() === 'team_leader';
        const createdByMaster = 
          (requester.createdBy && userId && requester.createdBy.toString() === userId.toString()) ||
          (requester.createdBy && email && requester.createdBy.toString() === email);

        if (isTeamLeader || createdByMaster) {
          hasPermission = true;
        }
      }
    } else if (normalizedRole === 'team_leader') {
      // Team Leader → 
      const requester = await usersCollection.findOne({ email: withdrawal.userEmail });
      if (requester && requester.createdBy) {
        const leaderId = userId && ObjectId.isValid(userId) ? userId.toString() : null;
        if (
          requester.createdBy.toString() === leaderId ||
          requester.createdBy.toString() === userId
        ) {
          hasPermission = true;
        }
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this withdrawal'
      });
    }
    // ===== পারমিশন চেক শেষ =====

    const result = await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (error) {
    console.error('Update Withdrawal Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== USERS ==========
// ★★★ এখানেই মূল ফিক্স করা হয়েছে ★★★
// এখন totalAmount = paid earnings - (approved/paid + pending withdrawals)
app.get('/api/admin/users', async (req, res) => {
  try {
    const { role, userId, email } = req.query;
    let query = {};

    // ========== ১. Query তৈরি ==========
    if (isMaster(role, email)) {
      // Master এর _id বের করা
      let masterId = null;
      let masterIdStr = null;

      if (userId && ObjectId.isValid(userId)) {
        masterId = new ObjectId(userId);
        masterIdStr = userId.toString();
      } else if (email) {
        const masterUser = await usersCollection.findOne({ email });
        if (masterUser) {
          masterId = masterUser._id;
          masterIdStr = masterUser._id.toString();
        }
      }

      // Master শুধু দেখবে:
      // - MASTER_ADMIN
      // - TEAM_LEADER
      // - SINGLE যেগুলো Master নিজে তৈরি করেছে (বা createdBy নেই)
      query = {
        $or: [
          { role: { $regex: /^(master_admin|team_leader)$/i } },
          {
            role: { $regex: /^single$/i },
            $or: [
              { createdBy: { $exists: false } },
              { createdBy: null },
              { createdBy: '' },
              ...(masterId
                ? [
                    { createdBy: masterId },
                    { createdBy: masterIdStr }
                  ]
                : [])
            ]
          }
        ]
      };
    } else if (role && role.toLowerCase() === 'team_leader') {
      let leaderId = null;
      let leaderIdStr = null;

      if (userId && ObjectId.isValid(userId)) {
        leaderId = new ObjectId(userId);
        leaderIdStr = userId.toString();
      } else if (email) {
        const leader = await usersCollection.findOne({ email });
        if (leader) {
          leaderId = leader._id;
          leaderIdStr = leader._id.toString();
        }
      }

      if (leaderId || leaderIdStr) {
        query = {
          $or: [
            { _id: leaderId },
            { createdBy: leaderId },
            { createdBy: leaderIdStr },
            ...(leaderIdStr && ObjectId.isValid(leaderIdStr)
              ? [{ createdBy: new ObjectId(leaderIdStr) }]
              : [])
          ]
        };
      } else {
        query = { _id: null };
      }
    } else {
      // Single বা অন্য রোল → শুধু নিজে
      if (userId && ObjectId.isValid(userId)) {
        query = { _id: new ObjectId(userId) };
      } else if (email) {
        query = { email };
      } else {
        query = { _id: null };
      }
    }

    // ========== ২. Aggregation ==========
    const users = await usersCollection
      .aggregate([
        { $match: query },

        // ১. নিজের Paid transactions
        {
          $lookup: {
            from: 'transactions',
            let: { uid: '$_id', uemail: '$email' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $or: [
                          { $eq: ['$userId', '$$uid'] },
                          { $eq: ['$userId', { $toString: '$$uid' }] },
                          { $eq: ['$userEmail', '$$uemail'] }
                        ]
                      },
                      {
                        $in: [
                          { $toLower: { $ifNull: ['$status', ''] } },
                          ['paid', 'success', 'settled', 'completed']
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: 'paidTxs'
          }
        },

        // ২. টিম মেম্বার খুঁজে বের করা
        {
          $lookup: {
            from: 'users',
            let: { leaderId: '$_id', leaderIdStr: { $toString: '$_id' } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$createdBy', '$$leaderId'] },
                      { $eq: ['$createdBy', '$$leaderIdStr'] }
                    ]
                  }
                }
              },
              { $project: { email: 1, _id: 1 } }
            ],
            as: 'teamMembers'
          }
        },

        // ৩. টিম মেম্বারদের Paid transactions
        {
          $lookup: {
            from: 'transactions',
            let: {
              teamIds: '$teamMembers._id',
              teamIdStrs: {
                $map: {
                  input: '$teamMembers._id',
                  as: 'id',
                  in: { $toString: '$$id' }
                }
              },
              teamEmails: '$teamMembers.email'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $or: [
                          { $in: ['$userId', '$$teamIds'] },
                          { $in: ['$userId', '$$teamIdStrs'] },
                          { $in: ['$userEmail', '$$teamEmails'] }
                        ]
                      },
                      {
                        $in: [
                          { $toLower: { $ifNull: ['$status', ''] } },
                          ['paid', 'success', 'settled', 'completed']
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: 'teamPaidTxs'
          }
        },

        // ৪. উইথড্রয়াল (নিজের + টিমের)
        {
          $lookup: {
            from: 'withdrawals',
            let: {
              uemail: '$email',
              teamEmails: '$teamMembers.email'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$userEmail', '$$uemail'] },
                      { $in: ['$userEmail', '$$teamEmails'] }
                    ]
                  }
                }
              }
            ],
            as: 'allWithdrawals'
          }
        },

        // ৫. হিসাব করা
        {
          $addFields: {
            myEarnings: { $ifNull: [{ $sum: '$paidTxs.amount' }, 0] },
            teamEarnings: { $ifNull: [{ $sum: '$teamPaidTxs.amount' }, 0] },

            // নিজের উইথড্র
            ownWithdrawn: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$allWithdrawals',
                      as: 'w',
                      cond: {
                        $and: [
                          { $eq: ['$$w.userEmail', '$email'] },
                          {
                            $in: [
                              { $toLower: { $ifNull: ['$$w.status', ''] } },
                              ['paid', 'approved', 'success', 'pending']
                            ]
                          }
                        ]
                      }
                    }
                  },
                  as: 'w',
                  in: {
                    $ifNull: [
                      '$$w.amount',
                      { $ifNull: ['$$w.originalAmount', 0] }
                    ]
                  }
                }
              }
            },

            // টিমের উইথড্র
            teamWithdrawn: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$allWithdrawals',
                      as: 'w',
                      cond: {
                        $and: [
                          { $ne: ['$$w.userEmail', '$email'] },
                          {
                            $in: [
                              { $toLower: { $ifNull: ['$$w.status', ''] } },
                              ['paid', 'approved', 'success', 'pending']
                            ]
                          }
                        ]
                      }
                    }
                  },
                  as: 'w',
                  in: {
                    $ifNull: [
                      '$$w.amount',
                      { $ifNull: ['$$w.originalAmount', 0] }
                    ]
                  }
                }
              }
            }
          }
        },

        // ৬. Final Balance গুলো (★ এখানে ফিক্স করা হয়েছে)
        {
          $addFields: {
            totalEarnings: {
              $add: ['$myEarnings', '$teamEarnings']
            },

            totalWithdrawn: {
              $add: ['$ownWithdrawn', '$teamWithdrawn']
            },

            // নিজের Available
            availableMyBalance: {
              $max: [{ $subtract: ['$myEarnings', '$ownWithdrawn'] }, 0]
            },

            // টিমের Available
            availableTeamBalance: {
              $max: [{ $subtract: ['$teamEarnings', '$teamWithdrawn'] }, 0]
            },

            // ★★★ Fixed: মোট Available = সব earnings - সব withdrawals ★★★
            totalAmount: {
              $max: [
                {
                  $subtract: [
                    { $add: ['$myEarnings', '$teamEarnings'] },
                    { $add: ['$ownWithdrawn', '$teamWithdrawn'] }
                  ]
                },
                0
              ]
            }
          }
        },

        // ৭. অপ্রয়োজনীয় ফিল্ড বাদ
        {
          $project: {
            password: 0,
            paidTxs: 0,
            teamMembers: 0,
            teamPaidTxs: 0,
            allWithdrawals: 0,
            ownWithdrawn: 0,
            teamWithdrawn: 0
          }
        }
      ])
      .toArray();

    res.status(200).json(users);
  } catch (err) {
    console.error('Fetch Users Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/admin/users-summary', async (req, res) => {
  try {
    const users = await usersCollection.find({}).project({ password: 0 }).toArray();

    const usersWithBalance = await Promise.all(
      users.map(async (user) => {
        const email = user.email;
        const userTxs = await transactionsCollection.find({ userEmail: email }).toArray();
        let totalEarnings = 0;
        userTxs.forEach((t) => {
          if (isPaidStatus(t.status)) totalEarnings += Number(t.amount || 0);
        });

        const userWds = await withdrawalsCollection.find({ userEmail: email }).toArray();
        let totalWithdrawn = 0;
        let pendingWithdrawn = 0;
        userWds.forEach((w) => {
          const status = (w.status || 'pending').toLowerCase();
          const amt = Number(w.amount || w.originalAmount || 0);
          if (status === 'paid' || status === 'approved') totalWithdrawn += amt;
          else if (status === 'pending') pendingWithdrawn += amt;
        });

        const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawn;
        return {
          ...user,
          totalEarnings,
          totalWithdrawn,
          pendingWithdrawn,
          availableBalance: availableBalance > 0 ? availableBalance : 0,
          totalAmount: availableBalance > 0 ? availableBalance : 0 // frontend compatibility
        };
      })
    );

    res.status(200).json({ success: true, users: usersWithBalance });
  } catch (error) {
    console.error('Admin Users Summary Error:', error);
    res.status(500).json({ success: false, message: error.message });
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
    if (creatorId && ObjectId.isValid(creatorId)) creatorId = new ObjectId(creatorId);

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
    console.error('Create User Error:', error);
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
    if (password && password.trim() !== '') updateData.password = password;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }
    res.status(200).json({ success: true, message: 'User Updated Successfully!' });
  } catch (error) {
    console.error('Update User Error:', error);
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
      return res.status(400).json({ success: false, message: 'Invalid user ID format!' });
    }
    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }
    res.status(200).json({ success: true, message: 'User Deleted Successfully!' });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting user' });
  }
});

app.put('/api/admin/update-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required!' });
    }
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found!' });
    if (user.password !== oldPassword) {
      return res.status(401).json({ success: false, message: 'Incorrect old password!' });
    }
    await usersCollection.updateOne(
      { email },
      { $set: { password: newPassword, updatedAt: new Date() } }
    );
    res.status(200).json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Update Password Error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating password' });
  }
});

app.get('/api/me', async (req, res) => {
  try {
    res.json({ name: 'Master Mamun', email: 'admin@mamun.com', role: 'master_admin' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== STATUS CHECK ==========
app.get('/i/:linkId/status', async (req, res) => {
  try {
    const { linkId } = req.params;
    let transaction = await transactionsCollection.findOne({ invoiceId: linkId });
    const btcpayUrl = process.env.BTCPAY_URL;
    const storeId = process.env.BTCPAY_STORE_ID;
    const apiKey = process.env.BTCPAY_API_KEY;
    const normalizedBtcpayUrl = btcpayUrl
      ? btcpayUrl.endsWith('/')
        ? btcpayUrl
        : `${btcpayUrl}/`
      : '';

    if (!transaction) {
      try {
        if (ObjectId.isValid(linkId)) {
          const txById = await transactionsCollection.findOne({ _id: new ObjectId(linkId) });
          if (txById?.invoiceId && normalizedBtcpayUrl) {
            const response = await axios.get(
              `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${txById.invoiceId}`,
              { headers: { Authorization: `token ${apiKey}` } }
            );
            return res.status(200).json({ status: response.data.status });
          }
        }
      } catch (e) {}
      return res.status(404).json({ status: 'not_found' });
    }

    if (normalizedBtcpayUrl && storeId && apiKey && transaction.invoiceId) {
      try {
        const btcpayRes = await axios.get(
          `${normalizedBtcpayUrl}api/v1/stores/${storeId}/invoices/${transaction.invoiceId}`,
          { headers: { Authorization: `token ${apiKey}` } }
        );
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
        console.error('Error fetching status from BTCPay:', btcErr.message);
      }
    }

    const paid = isPaidStatus(transaction.status);
    return res.status(200).json({ status: paid ? 'completed' : 'pending' });
  } catch (error) {
    console.error('Status Check Error:', error);
    return res.status(500).json({ status: 'error', message: `Internal server error: ${error.message}` });
  }
});



app.get('/api/team-leader/withdrawals', async (req, res) => {
  try {
    const { email, userId } = req.query; 

    
    const teamUsers = await User.find({ 
      $or: [{ createdBy: email }, { teamLeaderId: userId }, { leaderEmail: email }] 
    });

    const userEmails = teamUsers.map(u => u.email);
    if (email) {
      userEmails.push(email); 
    }

    
    const withdrawals = await Withdrawal.find({ 
      userEmail: { $in: userEmails } 
    }).sort({ createdAt: -1 });

    
    let totalTeamBalance = 0;
    
   
    teamUsers.forEach(u => {
      totalTeamBalance += Number(u.balance || 0);
    });

    
    const selfUser = teamUsers.find(u => u.email === email);
    if (!selfUser && email) {
      const leaderDoc = await User.findOne({ email });
      if (leaderDoc) {
        totalTeamBalance += Number(leaderDoc.balance || 0);
      }
    }

    res.status(200).json({
      success: true,
      balance: totalTeamBalance,
      withdrawals: withdrawals
    });

  } catch (err) {
    console.error("Team withdrawals error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========== OG / SHARE PREVIEW ==========
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
    console.error('OG image error:', err);
    return res.status(500).send('Error');
  }
});

app.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userAgent = req.headers['user-agent'] || '';
    const isSocialBot =
      /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|SkypeUriPreview|Slackbot/i.test(
        userAgent
      );

    
    const paymentDomain = 'https://pay-cash-apps.link';

    if (isSocialBot) {
      const formattedName = username.charAt(0).toUpperCase() + username.slice(1);
      const title = `Pay ${formattedName}`;
      const description = 'Send secure payment instantly via Cash App.';
      
    
      const previewImageUrl = `https://thunder-m-r18p.vercel.app/og/${encodeURIComponent(username)}`;
      
      
      const currentUrl = `${paymentDomain}/${username}`;

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

    
    return res.redirect(302, `${paymentDomain}/${username}`);
    
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).send('Server Error');
  }
});

// ========== START ==========
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server is running smoothly on port ${PORT}`);
  });
});