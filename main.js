'use strict'

const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))

console.log(argv)
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

function getBytes (device, platform, callback) {
  console.log('Platform:', platform)
  switch (platform) {
    case 'linux':
      fs.readFile(PROC_NET_DEV_PATH, (err, data) => {
        if (err) {
          callback(err)
        } else {
          // parse the data
          let lines = data.split('\n')
          let line = lines.filer((line, idx, arr) => {
            return line.startsWith(device)
          })[0]

          if (line) {
            let values = line.split(/\s+/).filter((value, idx, arr) => {
              return value.length > 0
            })
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
        console.log('Darwin stdout:', stdout)
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
  let platform = os.platform()

  let device = argv.d ? argv.d : argv.device
  if (!NET_IFACES[device]) {
    throw new Error(`"${device}" not recognized.`)
  }

  let url = argv.f ? argv.f : argv.file
  if (!url) {
    throw new Error('You must supply a URL to test the speed.')
  }

  let pollInterval = 1000 // default 1 second.
  if (argv.t || argv.time) {
    pollInterval = argv.t ? argv.t : argv.time
    pollInterval *= 1000 // seconds to millisecons.
  }

  let maxPolls = 10
  if (argv.n || argv.times) {
    maxPolls = argv.n ? argv.n : argv.times
  }

  let user
  let pass
  let userPass = argv.u ? argv.u : argv.user
  if (userPass) {
    [user, pass] = userPass.split(':')
  }

  startTransfer(url, user, pass)
  let timestamp = Date.now()
  let totalTime = maxPolls * pollInterval + 500

  let lastBytes = 0
  let intervalId = setInterval(function () {
    getBytes(device, platform, (err, bytesRx, bytesTx) => {
      if (err) console.error(err)

      console.log('bytesRx:', bytesRx)
      console.log('bytesTx:', bytesTx)
      let localTimestap = Date.now()
      let elapsedTime = localTimestap - timestamp
      timestamp = localTimestap

      console.log('elapsedTime:', truncDec(elapsedTime / 1000, 3))

      if (lastBytes === 0) {
        console.log('Not enough info to know the bitrate (two readings needed)')
      } else {
        let bytesDiff = bytesRx - lastBytes

        let elapsedSeconds = truncDec(elapsedTime / 1000, 3)
        let bitrateBps = truncDec(bytesDiff / elapsedSeconds, 3)
        console.log('bitrate (Bps):', bitrateBps)
      }
      lastBytes = bytesRx
    })
  }, pollInterval)
  setTimeout(function () {
    clearInterval(intervalId)
  }, totalTime)
}

init()
