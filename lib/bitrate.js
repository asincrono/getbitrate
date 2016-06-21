'use strict'
class Bitrate {
  constructor (bps) {
    this.bps = bps || 0
  }

  frombps (bps) {
    return new Bitrate(bps)
  }

  fromBps (Bps) {
    return new Bitrate(Bps * 8)
  }

  fromKbps (Kbps) {
    return new Bitrate(Kbps * 1000)
  }

  fromKBps (KBps) {
    return new Bitrate(KBps * 8000)
  }

  fromMbps (Mbps) {
    return new Bitrate(Mbps * 1000000)
  }

  fromMBps (MBps) {
    return new Bitrate(MBps * 8000000)
  }

  getbps () {
    return this.bps
  }

  getBps () {
    return (this.bps / 8)
  }

  getKbps () {
    return (this.bps / 1000)
  }

  getKBps () {
    return (this.bps / 8000)
  }

  getMbps () {
    return (this.bps / 1000000)
  }

  getMBps () {
    return (this.bps / 8000000)
  }

  get (unit) {
    switch (unit) {
      case 'bps': return this.bps
      case 'Bps': return this.getBps()
      case 'Kbps': return this.getKbps()
      case 'KBps': return this.getKBps()
      case 'Mbps': return this.getMbps()
      case 'MBps': return this.getMBps()
      default: return this.bps
    }
  }

  set (value, unit) {
    switch (unit) {
      case 'bps': this.bps = value
        break
      case 'Bps': this.bps = 8 * value
        break
      case 'Kbps': this.bps = 1000 * value
        break
      case 'KBps': this.bps = 8000 * value
        break
      case 'Mbps': this.bps = 1e6 * value
        break
      case 'MBps': this.bps = 8e6 * value
        break
      default: this.bps = value
    }
  }

  toString () {
    return `${this.bps} b/s`
  }
}

module.exports = Bitrate
