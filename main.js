'use strict'

const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))

const {
  execFile
} = require('child_process')
const fs = require('fs')
const os = require('os')

const PROC_NET_DEV_PATH = '/proc/net/dev'
const DARWIN_NETSTAT_CMD = 'netstat'
const DARWIN_NETSTAT_ARGS = ['-ib', '-I']
const CURL_CMD = 'curl'
const CURL_ARGS = ['-s', '-o', '/dev/null', '-w', '"%{speed_download}"']

const NET_IFACES = os.networkInterfaces()

function cleanLines (lines) {
  let cleanLines = []
  let cleanLine
  lines.forEach((line, idx, arr) => {
    cleanLine = line.replace(/^\s+/, '').replace(/\s+/, ' ').replace(/\s+$/, '')
    cleanLines.push(cleanLine)
  })
  return cleanLines
}

function getBytes (device, platform, callback) {
  switch (platform) {
    case 'linux':
      fs.readFile(PROC_NET_DEV_PATH, 'utf8', (err, data) => {
        if (err) {
          callback(err)
        } else {
          // parse the data
          let lines = data.split('\n')
          // stupid lines begin with ' '
          lines = cleanLines(lines)
          // not anymore muohoohoo
          let line = lines.filter((line, idx, arr) => {
            return line.startsWith(device)
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
    case 'darwin':
      let args = DARWIN_NETSTAT_ARGS.slice()
      args.push(device)
      execFile(DARWIN_NETSTAT_CMD, args, (err, stdout, stderr) => {
        if (err) {
          callback(err)
        } else {
          let lines = stdout.split('\n')
          let line = lines.filter((line, idx, arr) => {
            return line.startsWith(device)
          })[0]

          let values = line.split(/\s+/).filter((value, idx, arr) => {
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
    default:
      callback()
  }
}

function truncDec (number, decimals) {
  return Math.trunc(number * 10 * decimals) / (10 * decimals)
}

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

function startTransfer (url, user, pass) {
  let args = CURL_ARGS.slice()
  if (user) {
    if (pass) {
      args.push('-u')
      args.push(`${user}:${pass}`)
    } else {
      throw new Error('If user supplied, passworrd required too.')
    }
  }
  args.push(url)

  let timestamp = Date.now()

  execFile(CURL_CMD, args, (err, stdout, stderr) => {
    if (err) throw err

    let bytes = parseInt(stdout, 10)
    let elapsedTime = Date.now() - timestamp
    let elapsedSeconds = truncDec(elapsedTime / 1000, 3)
    let bitrateBps = bytes / elapsedSeconds

    console.log(`${url} transfer complete in ${elapsedSeconds} sencods ~ ${bitrateBps} B/s`)
  })
}

function init () {
  // options: -d --device, -u --units, -r --resource, -t --time, -n --readings
  // -p --precission
  let platform = os.platform()
  // -d --d -device --device
  let device = argv.d ? argv.d : argv.device

  if (!NET_IFACES[device]) {
    throw new Error(`"${device}" not recognized.`)
  }

  // -r --r -resource --resource the url we will test our speed with.
  let resource = argv.r ? argv.r : argv.resource
  if (!resource) {
    throw new Error('You must supply a URL to test the speed.')
  }

  // -t --t -time --time every each seconds we check the bitrate.
  let pollInterval = 1000 // default 1 second.
  if (argv.t || argv.time) {
    pollInterval = argv.t ? argv.t : argv.time
    pollInterval *= 1000 // seconds to millisecons.
  }

  // -n --n -readings --readings the number of times we check the bitrate.
  let maxPolls = 10
  if (argv.n || argv.times) {
    maxPolls = argv.n ? argv.n : argv.readings
  }

  // -a --autenticate if 'user:pass' string is needed.
  let user
  let pass
  let userPass = argv.a ? argv.a : argv.autenticate
  if (userPass) {
    [user, pass] = userPass.split(':')
  }

  // -u --u -units --units 'bps', 'Bps', 'Kbps', 'KBps', 'Mbps', 'MBps'
  let units = argv.u ? argv.u : argv.units

  // -p --precission number of decimals to show.
  let precission = argv.p || argv.precission

  let childProcess = startTransfer(resource, user, pass)
  let timestamp = Date.now()
  let totalTime = maxPolls * pollInterval + 500

  let lastBytes = 0
  let intervalId = setInterval(function () {
    getBytes(device, platform, (err, bytesRx, bytesTx) => {
      if (err) console.error(err)

      let localTimestap = Date.now()
      let elapsedTime = localTimestap - timestamp
      timestamp = localTimestap

      console.log('elapsedTime:', truncDec(elapsedTime / 1000, 3))

      if (lastBytes === 0) {
        console.log('Not enough info to know the bitrate (two readings needed)')
      } else {
        let bytesDiff = bytesRx - lastBytes

        let elapsedSeconds = elapsedTime / 1000

        let bitrate = new Bitrate(bytesDiff * 8 / elapsedSeconds)
        let bitrateValue
        if (units) {
          bitrateValue = bitrate.get(units)
          if (precission) {
            bitrateValue = truncDec(bitrateValue, precission)
          }
          console.log(`bitrate (${units}):, ${bitrateValue}`)
        } else {
          let bitrateValue = bitrate.getBps()
          if (precission) {
            truncDec(bitrateValue, precission)
          }
          console.log('bitrate (Bps):', bitrateValue)
        }
      }

      lastBytes = bytesRx
    })
  }, pollInterval)

  setTimeout(function () {
    clearInterval(intervalId)
    childProcess.kill('SIGSTOP')
  }, totalTime)
}

init()
