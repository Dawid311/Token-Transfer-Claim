const fetch = require('node-fetch');

// Test-Konfiguration
const API_BASE = 'http://localhost:3000';
const TEST_WALLET = '0x742d35Cc6634C0532925a3b8D44268D9c8c16c99'; // Beispiel-Adresse

async function testAPI() {
    console.log('🧪 API Tests werden gestartet...\n');

    try {
        // Test 1: Health Check
        console.log('1️⃣ Health Check Test...');
        const healthResponse = await fetch(`${API_BASE}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Health Check erfolgreich:', healthData);
        console.log('');

        // Test 2: Balance Check
        console.log('2️⃣ Balance Check Test...');
        const balanceResponse = await fetch(`${API_BASE}/balance/${TEST_WALLET}`);
        const balanceData = await balanceResponse.json();
        
        if (balanceResponse.ok) {
            console.log('✅ Balance Check erfolgreich:', balanceData);
        } else {
            console.log('❌ Balance Check fehlgeschlagen:', balanceData);
        }
        console.log('');

        // Test 3: Token Transfer (mit kleinem Betrag)
        console.log('3️⃣ Token Transfer Test...');
        const transferData = {
            amount: 0.01, // Sehr kleiner Test-Betrag
            walletAddress: TEST_WALLET
        };

        const transferResponse = await fetch(`${API_BASE}/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transferData)
        });

        const transferResult = await transferResponse.json();
        
        if (transferResponse.ok) {
            console.log('✅ Token Transfer erfolgreich:', transferResult);
        } else {
            console.log('❌ Token Transfer fehlgeschlagen:', transferResult);
        }

    } catch (error) {
        console.error('🚨 Fehler beim Testen der API:', error.message);
    }
}

// Test nur ausführen wenn das Skript direkt aufgerufen wird
if (require.main === module) {
    testAPI();
}

module.exports = { testAPI };
