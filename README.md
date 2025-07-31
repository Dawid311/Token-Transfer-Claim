# Token Transfer API

Eine Node.js Express API für automatische Token-Transfers auf der Base Chain.

## Features

- 🚀 Automatische Token-Transfers via POST Request
- � Zusätzliche ETH-Transaktion (0.000001 ETH) nach jedem Token-Transfer
- �🔐 Sichere Private Key Verwaltung über Umgebungsvariablen
- ⛓️ Base Chain Integration
- 📊 Token mit 2 Dezimalstellen Support
- 💰 Guthaben-Abfrage
- ✅ Eingabevalidierung
- 🛡️ Security Headers (Helmet)
- 🌐 CORS Support

## Token Konfiguration

- **Token-Adresse**: `0x69eFD833288605f320d77eB2aB99DDE62919BbC1`
- **Dezimalstellen**: 2
- **Netzwerk**: Base Chain

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env` Datei basierend auf `.env.example`:

```bash
cp .env.example .env
```

Bearbeiten Sie die `.env` Datei:

```env
PRIVATE_KEY=ihr_private_key_hier_ohne_0x_prefix
RPC_URL=https://mainnet.base.org
PORT=3000
```

**⚠️ Wichtig**: 
- Der Private Key sollte OHNE "0x" Prefix eingegeben werden
- Verwenden Sie niemals Ihren Private Key in Production ohne entsprechende Sicherheitsmaßnahmen
- Für Tests verwenden Sie einen separaten Testnet-Account

### 3. Server starten

```bash
# Produktionsstart
npm start

# Entwicklungsstart (mit Auto-Reload)
npm run dev
```

## API Endpoints

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "network": "Base Chain",
  "token": "0x69eFD833288605f320d77eB2aB99DDE62919BbC1"
}
```

### Token Balance abfragen
```
GET /balance/:address
```

**Parameter:**
- `address`: Ethereum-Adresse zum Prüfen des Guthabens

**Response:**
```json
{
  "address": "0x123...",
  "balance": 100.50,
  "rawBalance": "10050",
  "decimals": 2
}
```

### Token Transfer
```
POST /transfer
```

**Funktionalität:**
- Sendet die angegebene Anzahl Token an die Ziel-Wallet
- Sendet automatisch eine zusätzliche Mini-ETH-Transaktion (0.000001 ETH) an dieselbe Wallet
- Beide Transaktionen werden sequenziell ausgeführt

**Request Body:**
```json
{
  "amount": 10.50,
  "walletAddress": "0x742d35Cc6634C0532925a3b8d"
}
```

**Response (Erfolg):**
```json
{
  "success": true,
  "tokenTransfer": {
    "transactionHash": "0xabc123...",
    "amount": 10.50,
    "tokenAmount": "1050",
    "gasUsed": "21000",
    "blockNumber": "12345"
  },
  "ethTransfer": {
    "transactionHash": "0xdef456...",
    "amount": "0.000001",
    "amountWei": "1000000000000",
    "gasUsed": "21000",
    "blockNumber": "12346"
  },
  "from": "0x123...",
  "to": "0x742d35Cc6634C0532925a3b8d",
  "network": "Base Chain",
  "totalTransactions": 2
}
```

**Response (Fehler):**
```json
{
  "error": "Unzureichendes Guthaben",
  "available": 5.25,
  "requested": 10.50
}
```

## Beispiel-Nutzung

### cURL Beispiel

```bash
# Token Transfer
curl -X POST http://localhost:3000/transfer 
  -H "Content-Type: application/json" 
  -d '{
    "amount": 10.50,
    "walletAddress": "0x742d35Cc6634C0532925a3b8d"
  }'

# Guthaben prüfen
curl http://localhost:3000/balance/0x742d35Cc6634C0532925a3b8d
```

### JavaScript Beispiel

```javascript
// Token Transfer
const response = await fetch('http://localhost:3000/transfer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 10.50,
    walletAddress: '0x742d35Cc6634C0532925a3b8d'
  })
});

const result = await response.json();
console.log(result);
```

## Sicherheitshinweise

1. **Private Key Sicherheit**: Verwenden Sie niemals einen Private Key mit echten Funds in einer Development-Umgebung
2. **Rate Limiting**: Implementieren Sie Rate Limiting für Production
3. **Input Validation**: Die API validiert Eingaben, aber zusätzliche Validierung auf Client-Seite ist empfohlen
4. **HTTPS**: Verwenden Sie HTTPS in Production
5. **Environment Variables**: Halten Sie `.env` Dateien aus der Versionskontrolle heraus

## Fehlerbehandlung

Die API gibt strukturierte Fehlermeldungen zurück:

- `400`: Ungültige Eingabeparameter
- `500`: Server-/Blockchain-Fehler

## Development

### Mit Nodemon entwickeln

```bash
npm run dev
```

### Logs überwachen

Die API loggt alle wichtigen Ereignisse in die Konsole.

## Base Chain Netzwerk-Details

- **Mainnet RPC**: `https://mainnet.base.org`
- **Testnet RPC**: `https://goerli.base.org`
- **Chain ID**: 8453 (Mainnet), 84531 (Testnet)

## Lizenz

ISC