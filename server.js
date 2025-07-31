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

// Web3 Setup für Base Chain
const web3 = new Web3(process.env.RPC_URL || 'https://mainnet.base.org');

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

// Private Key Setup
if (!process.env.PRIVATE_KEY) {
  console.error('PRIVATE_KEY Umgebungsvariable ist erforderlich!');
  process.exit(1);
}

const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

// Token Contract Instance
const tokenContract = new web3.eth.Contract(TOKEN_CONFIG.abi, TOKEN_CONFIG.address);

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

// Token Balance abfragen
app.get('/balance/:address', async (req, res) => {
  try {
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

    // Transfer-Transaktion vorbereiten
    const transferData = tokenContract.methods.transfer(walletAddress, tokenAmount).encodeABI();

    // Gas-Limit schätzen
    const gasEstimate = await web3.eth.estimateGas({
      from: account.address,
      to: TOKEN_CONFIG.address,
      data: transferData
    });

    // Transaktion erstellen
    const transaction = {
      from: account.address,
      to: TOKEN_CONFIG.address,
      data: transferData,
      gas: gasEstimate,
      gasPrice: gasPrice,
      nonce: await web3.eth.getTransactionCount(account.address)
    };

    // Transaktion signieren und senden
    const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    res.json({
      success: true,
      transactionHash: receipt.transactionHash,
      from: account.address,
      to: walletAddress,
      amount: amount,
      tokenAmount: tokenAmount.toString(),
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber.toString(),
      network: 'Base Chain'
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
