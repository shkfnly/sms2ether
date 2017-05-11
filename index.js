var express = require('express')
var bodyParser = require('body-parser')
var Web3 = require('web3')
var ethUtil = require('ethereumjs-util')
var EthTx = require('ethereumjs-tx')

var state = {}
var transactionState = {}

var app = express()
var web3 = new Web3()
var SALT = 'FUCKKKKKKYESSSSS'
var ETHEREUM_CLIENT = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

var registryABI = [{"constant":false,"inputs":[{"name":"_phoneNumber","type":"bytes32"},{"name":"_address","type":"address"}],"name":"registerAddress","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"phone2address","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_address","type":"address"}],"name":"AddressAdded","type":"event"}]
var registryAddress = "0xfd26fde75d698bdbfcefcac97bcac1f037121f26"
let registryContract = ETHEREUM_CLIENT.eth.contract(registryABI).at(registryAddress)
app.set('port', (process.env.PORT || 3300))

app.use(bodyParser.urlencoded({extended: false}))

app.post('/sms', function (req, res) {
  var twilio = require('twilio')
  var twiml = new twilio.twiml.MessagingResponse()
  var sessionState = state[req.body.From]

  if (req.body.Body === 'register') {
    sessionState = 'registerRequest'
    twiml.message('Please Submit Password')
  }

  else if (sessionState === 'registerRequest') {
    sessionState = false
    var ethaddress = '0x' + ethUtil.privateToAddress(web3.sha3(SALT + req.body.From + req.body.Body)).toString('hex')
    var phonenumber = req.body.From.toString()
    registryContract.registerAddress(phonenumber, ethaddress, {from: ETHEREUM_CLIENT.eth.accounts[0]})
    twiml.message(`Your ethereum address is ${ethaddress}`)
  }

  else if (req.body.Body === 'balance') {
    let registryContract = ETHEREUM_CLIENT.eth.contract(registryABI).at(registryAddress)
    let publicAddress = registryContract.phone2address(req.body.From.toString())
    twiml.message(web3.fromWei(ETHEREUM_CLIENT.eth.getBalance(publicAddress), 'ether'))
  }

  else if (req.body.Body === 'send') {
    state[req.body.From] = 'sendRequest'
    twiml.message('Enter Destination and Amount as "destination, amount".')
  }

  else if (state[req.body.From] === 'sendRequest') {
    state[req.body.From] = 'sendConfirm'
    let values = req.body.Body.split(', ')
    transactionState[req.body.From] = values
    twiml.message('Please enter your password')
  }
  else if (state[req.body.From] === 'sendConfirm') {
    state[req.body.From] = false
    let privateKey = web3.sha3(SALT + req.body.From + req.body.Body)
    let value = web3.toWei(transactionState[req.body.From][1])
    var senderAddress = '0x' + ethUtil.privateToAddress(privateKey).toString('hex')
    let receiverAddress = registryContract.phone2address(transactionState[req.body.From][0].toString())
    var rawTx = {
      nonce: ETHEREUM_CLIENT.toHex(ETHEREUM_CLIENT.eth.getTransactionCount(receiverAddress)),
      from: senderAddress,
      to: receiverAddress,
      gas: ETHEREUM_CLIENT.toHex(21000),
      gasPrice: ETHEREUM_CLIENT.toHex(ETHEREUM_CLIENT.eth.gasPrice),
      value: ETHEREUM_CLIENT.toHex(value)
    }
    var tx = new EthTx(rawTx)
    tx.sign(new Buffer(privateKey.substring(2), 'hex'))
    var txData = tx.serialize().toString('hex')
    ETHEREUM_CLIENT.eth.sendRawTransaction(`0x${txData}`)
    twiml.message('Transaction Sent')
  } else {
    twiml.message('Hey')
  }
  res.writeHead(200, {'Content-Type': 'text/xml'})
  res.end(twiml.toString())
})

app.get('*', function(request, response) {
  // response.sendFile(__dirname + '/build/index.html')
  response.send('Hello World!')
})

app.listen(app.get('port'), function() {
  console.log("Express server started on port", app.get('port'))
})

// getBalance
// Initiate Transaction ( them sending Pay)
// Ask for details
// Ask for confirmation
// Sign
// Broadcast
