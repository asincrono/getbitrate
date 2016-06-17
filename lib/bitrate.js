'use strict'
class Bitrate {
  constructor (bps) {
    this.bps = bps || 0
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
  toString () {
    return `${this.bps} b/s`
  }
}

module.exports = Bitrate
