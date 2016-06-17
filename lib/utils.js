'use strict'

module.exports = {
  cleanLines: function cleanLines (lines) {
    let cleanLines = []
    let cleanLine
    lines.forEach((line, idx, arr) => {
      console.log('(cleanLines) line:', line)
      cleanLine = line.replace(/^\s+/, '').replace(/\s+/, ' ').replace(/\s+$/, '')
      console.log('(cleanLines) cleanLine:', cleanLine)
      cleanLines.push(cleanLine)
    })
    return cleanLines
  },
  truncDec: function truncDec (number, decimals) {
    let shift = Math.pow(10, decimals)
    return Math.trunc(number * shift) / (shift)
  }
}
