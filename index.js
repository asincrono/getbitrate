'use strict'

const {cleanLines, truncDec} = require('./lib/utils.js')
const {Bitrate} = require('./lib/bitrate.js')
const {WirelessInfo, getWirelessInfo} = require('./lib/signalinfo.js')

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



function saveData (file, data) {
  fs.appendFile(file, data, (err) => {
    if (err) console.error(err)
  })
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

  let childProcess = execFile(CURL_CMD, args, (err, stdout, stderr) => {
    if (err) {
      // nothing to see here as it's ok to get an error when proces killed.
    } else {
      let bytes = parseInt(stdout, 10)
      let elapsedTime = Date.now() - timestamp
      let elapsedSeconds = truncDec(elapsedTime / 1000, 3)
      let bitrateBps = bytes / elapsedSeconds

      console.log(`${url} transfer complete in ${elapsedSeconds} sencods ~ ${bitrateBps} B/s`)
    }
  })
  childProcess.on('exit', (code, signal) => {
    console.log(`curl task ended by ${signal}`)
  })
  return childProcess
}

function init () {
  // options: -d --device, -u --units, -r --resource, -t --time, -n --readings
  // -p --precission -a --autenticate
  let platform = os.platform()

  // -o --output the file where to save the results.
  let outputFile = argv.o ? argv.o : argv.output

  // -d --d -device --device
  let device = argv.d ? argv.d : argv.device

  if (!NET_IFACES[device]) {
    throw new Error(`"${device}" not recognized.`)
  }

  // -r --r -resource --resource the url we will test our speed with.
  let resource = argv.r ? argv.r : argv.resource
  if (!resource) {
    console.log('No transmission will be started, listing current bitrate values')
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

  let childProcess
  if (outputFile) {
    childProcess = startTransfer(resource, user, pass)
  }

  let timestamp = Date.now()
  let totalTime = (maxPolls + 1) * pollInterval + 500

  let lastBytes = 0

  console.log(`We are going to do ${maxPolls} readings each ${pollInterval / 1000} seconds`)
  let intervalId = setInterval(function () {
    getWirelessInfo((wirelessInfo) => {
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
          if (outputFile) {
            // dataToSave.push(`${timestamp} ${bytesRx} ${bitrate.get()}\n`)
            // fs.appendFile(outputFile, `${timestamp} ${bytesRx} ${bitrate.get()}\n`)
            saveData(outputFile, `${timestamp} ${wirelessInfo.getLevel(device)} ${bytesRx} ${bitrate.get()}\n`)
          }
        }
        lastBytes = bytesRx
      })
    })
  }, pollInterval)

  setTimeout(function () {
    clearInterval(intervalId)
    if (childProcess) {
      childProcess.kill('SIGKILL')
    }
  }, totalTime)
}

init()
