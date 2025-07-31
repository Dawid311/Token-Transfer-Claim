require('dotenv').config();
const express = require('express');
const { Web3 } = require('web3');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Token Konfiguration
const TOKEN_CONFIG = {
  address: '0x69eFD833288605f320d77eB2aB99DDE62919BbC1',
  decimals: 2,
  // ERC-20 Transfer ABI
  abi: [
    {
      "constant": false,
      "inputs": [
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "balance",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ]
};

// Private Key Setup - Lazy Loading für Vercel
let web3 = null;
let account = null;
let tokenContract = null;
let privateKey = null;

function initializeWeb3() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY Umgebungsvariable ist erforderlich!');
  }
  
  if (!web3) {
    web3 = new Web3(process.env.RPC_URL || 'https://mainnet.base.org');
  }
  
  if (!privateKey) {
    // Private Key formatieren - sicherstellen dass er mit 0x beginnt
    privateKey = process.env.PRIVATE_KEY.trim();
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }
    
    // Private Key validieren (muss 66 Zeichen lang sein: 0x + 64 hex Zeichen)
    if (privateKey.length !== 66) {
      throw new Error(`Private Key muss 64 Hex-Zeichen lang sein. Aktuell: ${privateKey.length - 2} Zeichen`);
    }
    
    // Überprüfen ob es nur gültige Hex-Zeichen enthält
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error('Private Key enthält ungültige Zeichen. Nur Hex-Zeichen (0-9, a-f, A-F) sind erlaubt.');
    }
  }
  
  if (!account) {
    account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);
  }
  
  if (!tokenContract) {
    tokenContract = new web3.eth.Contract(TOKEN_CONFIG.abi, TOKEN_CONFIG.address);
  }
  
  return { web3, account, tokenContract, privateKey };
}

// Utility Funktionen
function validateEthereumAddress(address) {
  return web3.utils.isAddress(address);
}

function validateAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && isFinite(num);
}

function toTokenUnits(amount) {
  // Konvertiert von menschenlesbaren Einheiten zu Token-Einheiten
  // Bei 2 Dezimalstellen: 1.00 Token = 100 Token-Einheiten
  return web3.utils.toBigInt(Math.floor(amount * Math.pow(10, TOKEN_CONFIG.decimals)));
}

// Routes

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    network: 'Base Chain',
    token: TOKEN_CONFIG.address
  });
});

// Debug Endpoint - nur für Entwicklung!
app.get('/debug', (req, res) => {
  try {
    const privateKeyLength = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.trim().length : 0;
    const privateKeyPrefix = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.trim().substring(0, 4) : 'N/A';
    
    res.json({
      privateKeyExists: !!process.env.PRIVATE_KEY,
      privateKeyLength: privateKeyLength,
      privateKeyPrefix: privateKeyPrefix,
      rpcUrl: process.env.RPC_URL || 'https://mainnet.base.org'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug-Fehler',
      message: error.message
    });
  }
});

// Token Balance abfragen
app.get('/balance/:address', async (req, res) => {
  try {
    const { web3, account, tokenContract } = initializeWeb3();
    const { address } = req.params;
    
    if (!validateEthereumAddress(address)) {
      return res.status(400).json({
        error: 'Ungültige Ethereum-Adresse'
      });
    }

    const balance = await tokenContract.methods.balanceOf(address).call();
    const humanReadableBalance = parseFloat(balance) / Math.pow(10, TOKEN_CONFIG.decimals);

    res.json({
      address,
      balance: humanReadableBalance,
      rawBalance: balance.toString(),
      decimals: TOKEN_CONFIG.decimals
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Guthabens:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen des Token-Guthabens',
      details: error.message
    });
  }
});

// Token Transfer
app.post('/transfer', async (req, res) => {
  try {
    const { web3, account, tokenContract, privateKey } = initializeWeb3();
    const { amount, walletAddress } = req.body;

    // Eingabevalidierung
    if (!amount || !walletAddress) {
      return res.status(400).json({
        error: 'amount und walletAddress sind erforderlich'
      });
    }

    if (!validateAmount(amount)) {
      return res.status(400).json({
        error: 'Ungültiger Betrag. Muss eine positive Zahl sein.'
      });
    }

    if (!validateEthereumAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Ungültige Wallet-Adresse'
      });
    }

    // Token-Einheiten berechnen
    const tokenAmount = toTokenUnits(amount);

    // Guthaben des Senders prüfen
    const senderBalance = await tokenContract.methods.balanceOf(account.address).call();
    
    if (BigInt(senderBalance) < tokenAmount) {
      return res.status(400).json({
        error: 'Unzureichendes Guthaben',
        available: parseFloat(senderBalance) / Math.pow(10, TOKEN_CONFIG.decimals),
        requested: amount
      });
    }

    // Gas-Preis abrufen
    const gasPrice = await web3.eth.getGasPrice();

    // 1. Token-Transfer-Transaktion vorbereiten
    const transferData = tokenContract.methods.transfer(walletAddress, tokenAmount).encodeABI();

    // Aktuelle Nonce abrufen
    const currentNonce = await web3.eth.getTransactionCount(account.address);

    // Gas-Limit für Token-Transfer schätzen
    const tokenGasEstimate = await web3.eth.estimateGas({
      from: account.address,
      to: TOKEN_CONFIG.address,
      data: transferData
    });

    // Token-Transfer-Transaktion erstellen
    const tokenTransaction = {
      from: account.address,
      to: TOKEN_CONFIG.address,
      data: transferData,
      gas: tokenGasEstimate,
      gasPrice: gasPrice,
      nonce: currentNonce
    };

    // Token-Transaktion signieren und senden
    const signedTokenTx = await web3.eth.accounts.signTransaction(tokenTransaction, privateKey);
    const tokenReceipt = await web3.eth.sendSignedTransaction(signedTokenTx.rawTransaction);

    // 2. Zusätzliche ETH-Transaktion (0.000001 ETH) vorbereiten
    const ethAmount = web3.utils.toWei('0.000001', 'ether'); // 0.000001 ETH in Wei
    
    // Neue Nonce für die zweite Transaktion (BigInt + 1)
    const ethNonce = BigInt(currentNonce) + BigInt(1);
    
    // Gas-Limit für ETH-Transfer schätzen
    const ethGasEstimate = await web3.eth.estimateGas({
      from: account.address,
      to: walletAddress,
      value: ethAmount
    });

    // ETH-Transfer-Transaktion erstellen
    const ethTransaction = {
      from: account.address,
      to: walletAddress,
      value: ethAmount,
      gas: ethGasEstimate,
      gasPrice: gasPrice,
      nonce: ethNonce
    };

    // ETH-Transaktion signieren und senden
    const signedEthTx = await web3.eth.accounts.signTransaction(ethTransaction, privateKey);
    const ethReceipt = await web3.eth.sendSignedTransaction(signedEthTx.rawTransaction);

    res.json({
      success: true,
      tokenTransfer: {
        transactionHash: tokenReceipt.transactionHash,
        amount: amount,
        tokenAmount: tokenAmount.toString(),
        gasUsed: tokenReceipt.gasUsed.toString(),
        blockNumber: tokenReceipt.blockNumber.toString()
      },
      ethTransfer: {
        transactionHash: ethReceipt.transactionHash,
        amount: '0.000001',
        amountWei: ethAmount.toString(),
        gasUsed: ethReceipt.gasUsed.toString(),
        blockNumber: ethReceipt.blockNumber.toString()
      },
      from: account.address,
      to: walletAddress,
      network: 'Base Chain',
      totalTransactions: 2
    });

  } catch (error) {
    console.error('Fehler beim Token-Transfer:', error);
    res.status(500).json({
      error: 'Fehler beim Senden der Token-Transaktion',
      details: error.message
    });
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unbehandelter Fehler:', err);
  res.status(500).json({
    error: 'Interner Serverfehler',
    message: err.message
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint nicht gefunden'
  });
});

// Server starten (nur für lokale Entwicklung)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Token Transfer API läuft auf Port ${PORT}`);
    console.log(`📝 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔗 Netzwerk: Base Chain`);
    console.log(`🪙 Token: ${TOKEN_CONFIG.address}`);
    console.log(`📊 Decimals: ${TOKEN_CONFIG.decimals}`);
  });
}

module.exports = app;
