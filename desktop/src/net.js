'use strict';

const os = require('os');

const VIRTUAL_ADAPTER = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|tailscale|zerotier|vpn|bluetooth/i;

function isPrivateIPv4(address) {
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * IPv4 addresses the phone could reach, best candidate first
 * (private LAN, physical adapter).
 */
function listLanAddresses(interfaces = os.networkInterfaces()) {
  const result = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' && addr.family !== 4) continue;
      if (addr.internal || addr.address.startsWith('169.254.')) continue;
      const score = (isPrivateIPv4(addr.address) ? 2 : 0) + (VIRTUAL_ADAPTER.test(name) ? 0 : 1);
      result.push({ name, address: addr.address, score });
    }
  }
  return result.sort((x, y) => y.score - x.score).map(({ name, address }) => ({ name, address }));
}

module.exports = { listLanAddresses };
