'use strict'

const fs = require('fs')

function cleanComma (fileIn) {
  fs.readFile(fileIn, 'utf8', (err, data) => {
    if (err) throw err
    let outData = data.replace(/,/g, '')
    fs.writeFile(fileIn, outData, (err) => {
      if (err) throw err
    })
  })
}

function cleanLines (lines) {
  let cleanLines = []
  let cleanLine
  lines.forEach((line) => {
    cleanLine = line.replace(/^\s+/, '').replace(/\s+/g, ' ').replace(/\s+$/, '')
    if (cleanLine.length > 0) {
      cleanLines.push(cleanLine)
    }
  })
  return cleanLines
}

function truncDec (number, decimals) {
  let shift = Math.pow(10, decimals)
  return Math.trunc(number * shift) / (shift)
}

module.exports = {
  cleanComma: cleanComma,
  cleanLines: cleanLines,
  truncDec: truncDec
}
