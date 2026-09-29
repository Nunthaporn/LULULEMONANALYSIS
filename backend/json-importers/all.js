const {
  importProductsFile,
  importReviewsFile,
  printResult,
} = require('./common')
const { closePool } = require('../config/db')

const REVIEW_FILES = [
  'reviews.json',
  'reviews_asia.json',
  'reviews_australia.json',
  'reviews_new_zealand.json',
]

async function main() {
  printResult(await importProductsFile('products.json'))
  for (const fileName of REVIEW_FILES) {
    printResult(await importReviewsFile(fileName))
  }
}

main()
  .catch((error) => {
    console.error(`Import failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => closePool())
