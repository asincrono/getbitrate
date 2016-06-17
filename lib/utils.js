'use strict'

module.exports = {
  cleanLines: function cleanLines (lines) {
    let cleanLines = []
    let cleanLine
    lines.forEach((line, idx, arr) => {
      cleanLine = line.replace(/^\s+/, '').replace(/\s+/g, ' ').replace(/\s+$/, '')
      if (cleanLine.length > 0) {
        cleanLines.push(cleanLine)
      }
    })
    return cleanLines
  },
  truncDec: function truncDec (number, decimals) {
    let shift = Math.pow(10, decimals)
    return Math.trunc(number * shift) / (shift)
  }
}
