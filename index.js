var Port = 1490;
var Cost = "0.01";
var Duration = (24 * 60 * 60);
var IgnoreHash = 'a0xf74071743345955fd9b24e4a67073002825a4c3c89e68747b87f1288de5caf62';

const bip39 = require('bip39');
const bitcoinLib = require('bitcoinjs-lib');
const crypto = require('crypto');
const ethers = require('ethers-wallet');
const fs = require('fs');
const http = require('http');
const ipAddress = require('ip-address');
const qr = require('qr-image');
const Cjdns = require('/opt/cjdns/tools/lib/cjdnsadmin/cjdnsadmin');
const PublicToIp6 = require('/opt/cjdns/tools/lib/publicToIp6').convert;

var provider = new ethers.providers.EtherscanProvider({testnet: true});

var config = (function() {
    var config = fs.readFileSync('/etc/cjdroute.conf').toString();
    config = config.replace(/\/\/[^\n]*\n/g, '\n');
    config = config.replace(/\/\*(\n|.)*\*\//g, '');
    config = config.replace(/,(\n| )*}/g, '}');
    config = config.replace(/,(\n| )*\]/g, ']');
    return JSON.parse(config);
})();

var network = (function() {
    var result = {};

    var data = fs.readFileSync('/etc/hostapd/hostapd.conf').toString();
    data.split('\n').forEach(function(line) {
        var parts = line.split('=');
        if (parts[0] === 'ssid') {
            result.ssid = parts[1].trim();
        } else if (parts[0] === 'wpa_passphrase') {
            result.password = parts[1].trim();
        }
   });

    return result;
})();

function getPeers() {
    return new Promise(function(resolve, reject) {
        var result = [];
        Cjdns.connectAsAnon(function (cjdns) {
            var again = function (i) {
                cjdns.InterfaceController_peerStats(i, function (error, ret) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    ret.peers.forEach(function (peer) {
                        result.push(peer);
                    });
                    
                    if (typeof(ret.more) !== 'undefined') {
                        again(i+1);
                    } else {
                        resolve(result);
                        cjdns.disconnect();
                    }
                });
            }
            again(0);
        });
    });
}

function getRecentTransaction(address) {
    return new Promise(function(resolve, reject) {
        provider._send('module=account&action=txlist&address=' + address + '&startblock=0&endblock=99999999&sort=desc', function(a) { return a; }).then(function(result) {
            resolve({
                blockNumber: parseInt(result[0].blockNumber),
                timestamp: parseInt(result[0].timeStamp),
                hash: result[0].hash
            });
        }, function(error) {
            resolve(null);
        });
    });
}

var wallet = (function() {
    var entropy = (ethers.utils.sha3(new Buffer(config.privateKey, 'hex'))).slice(0, 16);
    var mnemonic = bip39.entropyToMnemonic(entropy.toString('hex'));
    var hdnode = bitcoinLib.HDNode.fromSeedHex(bip39.mnemonicToSeedHex(mnemonic));
    
    var ethereumNode = hdnode.derivePath("m/44'/60'/0'/0/0");

    var privateKey = ethereumNode.keyPair.d.toBuffer(32);
    var wallet = new ethers(privateKey);

    function getPeerDepositAddress(peerAddress) {
        peerAddress = (new ipAddress.Address6(peerAddress)).canonicalForm();

        var slot = (ethers.utils.sha3(new Buffer(peerAddress.replace(':', ''), 'hex'))).slice(0, 4);
        slot = ((slot[0] & 0x7f) << 24) | (slot[1] << 16) | (slot[2] << 8) | slot[3];

        var peerNode = hdnode.derivePath("m/44'/60'/1'/0/" + slot);
        var wallet = new ethers(peerNode.keyPair.d.toBuffer(32));
        return wallet.address;
    }

    return {
        address: wallet.address,
        getPeerDepositAddress: getPeerDepositAddress,
        mnemonic: mnemonic,
        sign: wallet.sign
    }
})();


var handler = function(request, response) {
    function sendError(statusCode, reason) {
        var data = JSON.stringify({
            status: 'ERROR',
            code: statusCode,
            message: reason
        });
        response.writeHead(200, 'OK', {'Content-Length': String(data.length)});
        response.end(data);
    }
    
    function sendMessage(result) {
        var data = JSON.stringify({
            status: 'OK',
            result: result
        });

        response.writeHead(200, 'OK', {'Content-Length': String(data.length)});
        response.end(data);
    }
    
    if (request.url === '/peers') {
        getPeers().then(function(peers) {
            var result = [];
            peers.forEach(function(peer) {
                result.push(PublicToIp6(peer.publicKey));
            });
            sendMessage(result);

        }, function(error) {
            console.log('Error:', error);
            sendError(500, 'Server Error');
        });

    } else if (request.url === '/status') {
        var address = wallet.getPeerDepositAddress(request.connection.remoteAddress);
        getRecentTransaction(address).then(function(transaction) {
            if (transaction.hash === IgnoreHash) {
                transaction = null;
            }

            var qrcode = qr.imageSync('iban:' + address + '?amount=' + Cost, { type: 'png' });
            var result = {
                address: address,
                qrcode: 'data:image/png;base64,' + qrcode.toString('base64'),
                ssid: network.ssid,
                expires: 0
            };

            if (transaction) {
                console.log(transaction.hash);
                var expires = (transaction.timestamp + Duration);
                console.log(expires * 1000, (new Date()).getTime());
                if (expires * 1000 > (new Date()).getTime()) {
                    result.expires = expires;
                    result.password = network.password;
                }
            }
            sendMessage(result);
        }, function(error) {
            console.log(error);
            sendError(500, 'Server Error');
        });

    } else if (request.url === '/mnemonic') {
        // @TOOD: Check remoteAddress is localhost
        sendMessage(wallet.mnemonic);

    } else {
        sendError(404, 'Not Found');
    }
};

var server = http.createServer(handler);

server.listen(Port, function() {
    console.log('Listening:', Port);
});
