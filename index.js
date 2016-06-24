/* eslint no-process-exit: 1 */
'use strict'

const {Bitrate} = require('./lib/bitrate.js')
const {getWirelessInfo, getWirelessInfoSync, getBytes, getBytesSync} = require('./lib/netinfo.js')

const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))

const {execFile} = require('child_process')
const fs = require('fs')
const os = require('os')

const CURL_CMD = 'curl'
const CURL_ARGS = ['-s', '-o', '/dev/null', '-w', '"%{speed_download}"']

class Executor {
  constructor (cmd, args) {
    this.cmd = cmd
    this.args = args
  }

  callback (err, stdout, stderr) {
    console.log(`"${this.cmd}" task ended.`)
    if (err) {
      console.error('Error:', err)
    } else {
      if (stdout) {
        console.log(`${this.cmd} stdout: ${stdout}`)
      }
      if (stderr) {
        console.log(`${this.cmd} stderr: ${stderr}`)
      }
      console.log(`Restarting "${this.cmd}"`)
      this.run()
    }
  }

  run () {
    console.log(`Running: ${this.cmd} ${this.args}`)
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
      throw new Error('If user login supplied, password required too.')
    }
  }

  args.push(url)

  let executor = new Executor(CURL_CMD, args)
  executor.run()

  return executor
}

function getDefaultIface () {
  let ifaces = os.networkInterfaces()
  for (let iface in ifaces) {
    if (!ifaces[iface].internal) {
      return iface
    }
  }
  return null
}

function getOptions () {
  let options = {}
  options.platform = os.platform()

  options.device = argv.d || argv.device
  if (!options.device) {
    options.device = getDefaultIface()
  }
  options.sync = argv.sync
  options.outputFile = argv.o || argv.output
  options.resource = argv.r || argv.resource
  options.pollInterval = argv.t || argv.time || 1
  options.maxPolls = argv.n || argv.number || 10
  options.userPass = argv.a || argv.autenticate
  options.units = argv.u || argv.units || 'Mbps'
  options.precission = argv.p || argv.precission || 3
  return options
}

function init () {
  let options = getOptions()
  if (!options.device) throw new Error('You need to supply a device: -e <device_id>')

  let outputBuff = Buffer.alloc(options.maxPolls * 128, 'utf8') // 128 chars per line.
  let executor
  if (options.resource) {
    let user
    let pass
    if (options.userPass) {
      [user, pass] = options.userPass.split(':')
    }
    executor = startTransfer(options.resource, user, pass)
  }

  let pollIntervalMillis = options.pollInterval * 1000

  let totalTime = pollIntervalMillis * options.maxPolls + options.pollInterval / 2
  console.log('totalTime:', totalTime)

  let timestamp = Date.now()
  let lastBytes

  process.on('SIGINT', () => {
    console.log('User manual ending (Ctrl + c)')
    if (executor) {
      executor.kill()
    }
    process.exit()
  })

  function getNetInfo () {
    getWirelessInfo((wirelessInfo) => {
      getBytes(options.device, options.platform, (err, bytesRx) => {
        if (err) console.error(err)

        let localTimestap = Date.now()
        let elapsedTime = localTimestap - timestamp
        timestamp = localTimestap

        if (lastBytes) {
          let bytesDiff = bytesRx - lastBytes
          // rx bytes counter has been restarted ("only" happens in 32 bit arch.)
          if (bytesDiff < 0) {
            bytesDiff = Math.pow(2, 32) - bytesDiff
          }

          let elapsedSeconds = elapsedTime / 1000

          let bitrate = new Bitrate(bytesDiff * 8 / elapsedSeconds)
          let bitrateValue = bitrate.get(options.units)
          console.log(`Time elapsed: ${elapsedSeconds.toFixed(3)} s`)
          console.log(`bitrate (${options.units}): ${bitrateValue.toFixed(options.precission)}`)
          console.log(`signal level ${wirelessInfo.getLevel(options.device)}`)

          /* Save output to memory*/
          outputBuff.write(`${timestamp} ${wirelessInfo.getLevel(options.device)} ${bytesRx} ${bitrate.get(options.units).toFixed(options.precission)}\n`)
          // if (options.outputFile) {
          //   fs.appendFile(options.outputFile,
          //     `${timestamp} ${wirelessInfo.getLevel(options.device)} ${bytesRx} ${bitrate.get()}\n`,
          //     'utf8',
          //     (err) => {
          //       if (err) throw err
          //     })
          // }
        } else {
          console.log('Not enough info to know the bitrate (two readings needed)')
        }
        lastBytes = bytesRx
      })
    })
  }

  function getNetInfoSync () {
    let wirelessInfo = getWirelessInfoSync(options.device)
    let bytesRx

    [bytesRx] = getBytesSync(options.device)
    let localTimestamp = Date.now()
    if (lastBytes) {
      let elapsedTime = localTimestamp - timestamp
      timestamp = localTimestamp

      let elapsedSeconds = elapsedTime / 1000
      let bytesDiff = bytesRx - lastBytes

      if (bytesDiff < 0) {
        bytesDiff = Math.pow(2, 32) - bytesDiff
      }

      let bitrate = Bitrate.fromBps(bytesDiff / elapsedSeconds)
      let bitrateValue = bitrate.get(options.units)
      console.log(`Time elapsed: ${elapsedSeconds} s`)
      console.log(`bitrate (${options.units}): ${bitrateValue.toFixed(options.precission)}`)
      console.log(`signal level: ${wirelessInfo.getLevel(options.device)}`)
      outputBuff.write(`${timestamp} ${wirelessInfo.getLevel(options.device)} ${bytesRx} ${bitrate.get(options.units).toFixed(options.precission)}\n`)
      // if (options.outputFile) {
      //   fs.appendFileSync(options.outputFile,
      //     `${timestamp} ${wirelessInfo.getLevel(options.device)} ${bytesRx} ${bitrate.get(options.units).toFixed(options.precission)}\n`,
      //     'utf8')
      // }
    } else {
      console.log('Not enough info to know the bitrate (two readings needed)')
    }
    lastBytes = bytesRx
  }

  console.log('Option.sync on?:', options.sync)

  let intervalFunc = options.sync ? getNetInfoSync : getNetInfo
  let intervalId = setInterval(intervalFunc, pollIntervalMillis)

  setTimeout(function () {
    clearInterval(intervalId)

    if (options.outputFile) {
      fs.appendFile(options.outputFile, outputBuff, 'utf8', (err) => {
        if (err) throw err
      })
    }

    if (executor) {
      console.log('Time to say goodbye: Killing the executor.')
      executor.kill()
    }
  }, totalTime)
}

init()
