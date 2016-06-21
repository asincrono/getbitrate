'use strict'
const fs = require('fs')
const {cleanLines} = require('./utils.js')
const {execFile} = require('child_process')

const PROC_NET_DEV_PATH = '/proc/net/dev'

const DARWIN_NETSTAT_CMD = 'netstat'
const DARWIN_NETSTAT_ARGS = ['-ib', '-I']

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

  getQuality (iface) {
    if (this[iface]) {
      return this[iface].quality
    }
    return null
  }

  getLevel (iface) {
    if (this[iface]) {
      return this[iface].quality.level
    }
    return null
  }

  getIfaceInfoString (iface) {
    if (this[iface]) {
      return `${iface}:
        status: ${this[iface].status}
        quality:
          link:  ${this[iface].quality.link}
          level: ${this[iface].quality.level}
          noise: ${this[iface].quality.noise}
        discarded packets:
          nwid: ${this[iface].discardedPackets.nwid}
          crypt: ${this[iface].discardedPackets.crypt}
          frag: ${this[iface].discardedPackets.frag}
          retry: ${this[iface].discardedPackets.retry}
          misc: ${this[iface].discardedPackets.misc}
        missed beacon: ${this[iface].missedBeacon}
      `
    }
    return null
  }

  toString () {
    if (this.length > 0) {
      let output = ''
      for (let iface in this) {
        if (this.hasOwnProperty(iface) && iface !== 'length') {
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

    let values
    let iface
    let status
    let quality
    let discarded
    let missedBeacon

    let limit = lines.length
    // First 2 lines are header text.
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

function getWirelessInfoSync () {
  let data = fs.readFileSync('/proc/net/wireless', 'utf8')
  let wirelessInfo = new WirelessInfo()
  let lines = data.split('\n')
  lines = cleanLines(lines)

  let values
  let iface
  let status
  let quality
  let discarded
  let missedBeacon

  let limit = lines.length
  // First 2 lines are header text.
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
  return wirelessInfo
}

function getBytes (device, platform, callback) {
  switch (platform) {
    case 'linux': {
      fs.readFile(PROC_NET_DEV_PATH, 'utf8', (err, data) => {
        if (err) {
          callback(err)
        } else {
          // parse the data
          let lines = data.split('\n')
          // stupid lines begin with ' '
          lines = cleanLines(lines)
          // not anymore muohoohoo
          let line = lines.filter((line) => {
            return line.startsWith(`${device}:`)
          })[0]

          if (line) {
            let values = line.split(/\s+/)
            let bytesRx = values[1]
            let bytesTx = values[9]
            callback(null, parseInt(bytesRx, 10), parseInt(bytesTx, 10))
          } else {
            callback(new Error(`"${device}" not found.`))
          }
        }
      })
      break
    }
    case 'darwin': {
      let args = DARWIN_NETSTAT_ARGS.slice()
      args.push(device)
      execFile(DARWIN_NETSTAT_CMD, args, (err, stdout) => {
        if (err) {
          callback(err)
        } else {
          let lines = stdout.split('\n')
          let line = lines.filter(line => line.startsWith(device))[0]

          let values = line.split(/\s+/).filter((value) => {
            return value.length > 0
          })
          let bytesRx
          let bytesTx
          if (values.length < 11) {
            // We are missning address filed, Ibytes at column 6 (instead of 7)
            bytesRx = values[5]
            bytesTx = values[8]
          } else {
            bytesRx = values[6]
            bytesTx = values[9]
          }
          callback(err, parseInt(bytesRx, 10), parseInt(bytesTx, 10))
        }
      })
      break
    }
    default:
      callback()
  }
}

function getBytesSync (device) {
  let data = fs.readFileSync(PROC_NET_DEV_PATH, 'utf8')

  let line = data.split('\n').filter(line => line.includes(`${device}:`))[0]
  let values = line.split(/\s+/).filter(value => value.length > 0)
  let bytesRx = values[1]
  let bytesTx = values[9]

  return [parseInt(bytesRx, 10), parseInt(bytesTx, 10)]
}

module.exports = {
  WirelessInfo: WirelessInfo,
  getWirelessInfo: getWirelessInfo,
  getWirelessInfoSync: getWirelessInfoSync,
  getBytes: getBytes,
  getBytesSync: getBytesSync
}
