'use strict'

module.exports = {
  cleanLines: function cleanLines (lines) {
    let cleanLines = []
    lines.forEach((line, idx, arr) => {
      console.log('(cleanLines) line:', line)
      console.log('(cleanLines) cleanLine:', line.replace(/^\s+/, '').replace(/\s+/, ' ').replace(/\s+$/, ''))
      cleanLines.push(line.replace(/^\s+/, '').replace(/\s+/g, ' ').replace(/\s+$/, ''))
    })
    return cleanLines
  },
  truncDec: function truncDec (number, decimals) {
    let shift = Math.pow(10, decimals)
    return Math.trunc(number * shift) / (shift)
  }
}
