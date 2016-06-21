'use strict'

/* eslint complexity off */


const {cleanLines, truncDec} = require('./lib/utils.js')
const Bitrate = require('./lib/bitrate.js')
const {getWirelessInfo} = require('./lib/signalinfo.js')

const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))

const { execFile } = require('child_process')
const fs = require('fs')
const os = require('os')

const PROC_NET_DEV_PATH = '/proc/net/dev'
const DARWIN_NETSTAT_CMD = 'netstat'
const DARWIN_NETSTAT_ARGS = ['-ib', '-I']
const CURL_CMD = 'curl'
const CURL_ARGS = ['-s', '-o', '/dev/null', '-w', '"%{speed_download}"']

const NET_IFACES = os.networkInterfaces()

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
    }
    case 'darwin': {
      let args = DARWIN_NETSTAT_ARGS.slice()
      args.push(device)
      execFile(DARWIN_NETSTAT_CMD, args, (err, stdout) => {
        if (err) {
          callback(err)
        } else {
          let lines = stdout.split('\n')
          let line = lines.filter((line) => {
            return line.startsWith(device)
          })[0]

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

class Executor {
  constructor (cmd, args) {
    this.cmd = cmd
    this.args = args
  }

  callback (err, stdout, stderr) {
    if (err) throw err
    if (stdout) {
      console.log(`${this.cmd} stdout: ${stdout}`)
    }
    if (stderr) {
      console.log(`${this.cmd} stderr: ${stderr}`)
    }
    this.run()
  }

  run () {
    this.childProcess = execFile(this.cmd, this.args, this.callback.bind(this))
    this.childProcess.on('exit', (code, signal) => {
      if (code) console.log('Exit code:', code)
      if (signal) console.log('Exit signal:', signal)
    })
  }

  signal (signal) {
    this.childProcess.kill(signal)
  }

  stop () {
    this.childProcess.kill('SIGSTOP')
  }

  kill () {
    this.childProcess.kill('SIGKILL')
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

  let executor = new Executor(CURL_CMD, args)
  executor.run()

  return executor
}

function getOptions () {
  return {
    platform: os.platform(),
    outputFile: argv.o || argv.output,
    device: argv.d || argv.device,
    resource: argv.r || argv.resource,
    pollInterval: argv.t || argv.time || 1,
    maxPolls: argv.n || argv.number || 10,
    userPass: argv.a || argv.autenticate,
    units: argv.u || argv.units || 'Mbps',
    precission: argv.p || argv.precission || 3
  }
}

function init () {
  let options = getOptions()
  if (!options.device) throw new Error('You need to supply a device: -e <device_id>')

  let executor
  if (options.resource) {
    let user
    let pass
    if (options.userPass) {
      [user, pass] = options.userPass.split(':')
    }
    executor = startTransfer(options.resource, user, pass)
  }

  let timestamp = Date.now()
  let lastBytes
  let intervalId = setInterval(function () {
    getWirelessInfo((wirelessInfo) => {
      getBytes(options.device, options.platform, (err, bytesRx) => {
        if (err) console.error(err)

        let localTimestap = Date.now()
        let elapsedTime = localTimestap - timestamp
        timestamp = localTimestap

        console.log('elapsedTime:', truncDec(elapsedTime / 1000, 3))

        if (lastBytes === 0) {
          console.log('Not enough info to know the bitrate (two readings needed)')
        } else {
          let bytesDiff = bytesRx - lastBytes

          // rx bytes counter has been restarted ("only" happens in 32 bit arch.)
          if (bytesDiff < 0) {
            bytesDiff = Math.pow(2, 32) - bytesDiff
          }

          let elapsedSeconds = elapsedTime / 1000

          let bitrate = new Bitrate(bytesDiff * 8 / elapsedSeconds)
          let bitrateValue
          if (options.units) {
            bitrateValue = bitrate.get(options.units)
            if (options.precission) {
              bitrateValue = truncDec(bitrateValue, options.precission)
            }
            console.log(`bitrate (${options.units}):, ${bitrateValue}`)
          } else {
            let bitrateValue = bitrate.getBps()
            if (options.precission) {
              truncDec(bitrateValue, options.precission)
            }
            console.log('bitrate (Bps):', bitrateValue)
          }
          if (options.outputFile) {
            // dataToSave.push(`${timestamp} ${bytesRx} ${bitrate.get()}\n`)
            // fs.appendFile(outputFile, `${timestamp} ${bytesRx} ${bitrate.get()}\n`)
            // fs.write(
            //   outputFd,
            //   `${timestamp} ${wirelessInfo.getLevel(device)} ${bytesRx} ${bitrate.get()}\n`,
            //   'utf8',
            //   (err, written, string) => {
            //     if (err) throw err
            //   }
            // )
            fs.appendFile(options.outputFile,
              `${timestamp} ${wirelessInfo.getLevel(options.device)} ${bytesRx} ${bitrate.get()}\n`,
              'utf8',
              (err) => {
                if (err) throw err
              })
          }
        }
        lastBytes = bytesRx
      })
    })
  }, options.pollInterval)

  setTimeout(function () {
    clearInterval(intervalId)
    if (executor) {
      executor.kill()
    }
  }, totalTime)
}

for (let iface in NET_IFACES) {
  console.log('iface:', iface)
}
