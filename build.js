const webpack = require('webpack')
const { resolve } = require('path')
const CopyPlugin = require('copy-webpack-plugin-advanced')
const argParser = require('minimist')
const puppeteer = require('puppeteer')
const http = require('http')
const { createReadStream } = require('fs')

const arg = argParser(process.argv.slice(2))
const extensionPath = resolve(__dirname, './release')
const server = http.createServer((req, res) => {
  createReadStream('./extension-test.html')
    .pipe(res)
})

let useConfig = {}
let browser = null

class AfterCompilationPlugin {
  /**
   * 
   * @param {Function} initial 
   * @param {Function} cleanup 
   */
  constructor(initial, cleanup) {
    this.name = 'AfterCompilationPlugin'
    this.initial = initial
    this.cleanup = cleanup
  }
  /**
   * 
   * @param {webpack.Compiler} compiler 
   */
  apply(compiler) {
    compiler.hooks.done.tapPromise(this.name, async () => {
      await this.initial()
    })

    compiler.hooks.beforeCompile.tapPromise(this.name, async () => {
      await this.cleanup()
    })
  }
}

async function lauchChrome() {
  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    defaultViewport: null
  })

  await (await browser.pages())[0].goto('http://127.0.0.1:3000')
}

async function closeChrome() {
  if (browser) {
    await browser.close()
    browser = null
  }
}

const config = {
  mode: 'production',
  context: resolve(__dirname, 'src'),
  resolve: {
    extensions: ['.js']
  },
  entry: {
    'content_script': './content_script.js',
    background: './background.js',
    popup: './popup.js'
  },
  output: {
    filename: '[name].js',
    path: resolve(__dirname, 'release')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin([
      'manifest.json',
      'popup.html',
    ]),
    new AfterCompilationPlugin(lauchChrome, closeChrome)
  ]
}

useConfig = { ...config, watch: arg.watch }
server.listen(3000, () => {
  console.log(`server@${server.address().port} is running ...`)
})
webpack(useConfig, (err, stat) => {

  if (err) {
    throw err
  } if (stat.hasErrors()) {
    throw stat.toString()
  }

  console.log('\ncompile DONE...\n');

})