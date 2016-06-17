'use strict'
const fs = require('fs')
const {cleanLines} = require('./utils.js')

class WirelessInfo {
  constructor () {
    this.length = 0
  }

  addIfaceInfo (iface, status, quality, discardedPackets, missedBeacon) {
    this[iface] = {
      status: status,
      quality: quality,
      discardedPackets: discardedPackets,
      missedBeacon: missedBeacon
    }
    this.length += 1
  }

  getIfaceInfo (iface) {
    return this[iface]
  }

  getIfaceInfoString (iface) {
    if (this[iface]) {
      return `${iface}:
        status: ${this[iface].status}
        quality: ${this[iface].quality}
        discarded packets: ${this[iface].discarded}
        missed beacon: ${this[iface].missedBeacon}
      `
    }
    return null
  }

  toString () {
    if (this.length > 0) {
      let output = ''
      for (let iface in this) {
        if (this.hasOwnProperty(iface)) {
          output += this.getIfaceInfoString(iface)
        }
      }
      return output
    }
    return null
  }
}

function getWirelessInfo (callback) {
  fs.readFile('/proc/net/wireless', 'utf8', (err, data) => {
    if (err) throw err
    let wirelessInfo = new WirelessInfo()
    let lines = data.split('\n')
    lines = cleanLines(lines)
    console.log('(getWirelessInfo) lines:', lines)
    // First 2 lines are header text.
    let values
    let iface
    let status
    let quality
    let discarded
    let missedBeacon
    let limit = lines.length
    for (let i = 2; i < limit; i += 1) {
      values = lines[i].split(' ')
      iface = values[0].slice(0, -1) // iface name ends with ':'
      status = parseInt(values[1], 10)
      quality = {
        link: parseInt(values[2], 10),
        level: parseInt(values[3], 10),
        noise: parseInt(values[4], 10)
      }
      discarded = {
        nwid: parseInt(values[5], 10),
        cyrpt: parseInt(values[6], 10),
        frag: parseInt(values[7], 10),
        retry: parseInt(values[8], 10),
        misc: parseInt(values[9], 10)
      }
      missedBeacon = parseInt(values[10], 10)
      wirelessInfo.addIfaceInfo(iface, status, quality, discarded, missedBeacon)
    }
    callback(wirelessInfo)
  })
}

module.exports = {
  getWirelessInfo: getWirelessInfo,
  WirelessInfo: WirelessInfo
}
