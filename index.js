var express = require('express')
var bodyParser = require('body-parser')
var Web3 = require('web3')
var ethUtil = require('ethereumjs-util')
var EthTx = require('ethereumjs-tx')

var state = {}
var transactionState = {}

var app = express()
var web3 = new Web3()
var accountSid = 'AC984b5878a42f60b51fa837652f683686'
var authToken = '535e2fd134fdbf5ac36b6a7044481871'
var SALT = 'FUCKKKKKKYESSSSS'
var ETHEREUM_CLIENT = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

var registryABI = [{"constant":false,"inputs":[{"name":"_phoneNumber","type":"bytes32"},{"name":"_address","type":"address"}],"name":"registerAddress","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"phone2address","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_address","type":"address"}],"name":"AddressAdded","type":"event"}]
var registryAddress = '0x62d69f6867a0a084c6d313943dc22023bc263691'
let registryContract = ETHEREUM_CLIENT.eth.contract(registryABI).at(registryAddress)
app.set('port', (process.env.PORT || 3300))

app.use(bodyParser.urlencoded({extended: false}))

app.post('/sms', function (req, res) {
  var twilio = require('twilio')
  var twiml = new twilio.twiml.MessagingResponse()

  // Password verification should likely be 2 steps
  if (req.body.Body.trim().toLowerCase() === 'register') {
    state[req.body.From] = 'registerRequest'
    twiml.message(
      `Welcome to sms2ether. This service will connect your mobile number to an ethereum address.
       Please send the account password you desire`
    )
  }

  else if (state[req.body.From] === 'registerRequest') {
    state[req.body.From] = false
    var ethaddress = '0x' + ethUtil.privateToAddress(web3.sha3(SALT + req.body.From + req.body.Body)).toString('hex')
    var phonenumber = req.body.From.toString()
    registryContract.registerAddress(phonenumber, ethaddress, {from: ETHEREUM_CLIENT.eth.accounts[0]})
    twiml.message(
      `Congratulations registration was successful. Your ethereum address is ${ethaddress}.
       If you ever need to access this address just send the command /address.
      `
    )
  }

  else if (req.body.Body.trim().toLowerCase() === '/address') {
    let ethaddress = registryContract.phone2address(req.body.From.toString())
    twiml.message(
      `Your ethereum address is ${ethaddress}`
    )
  }

  else if (req.body.Body.trim().toLowerCase() === 'balance') {
    let registryContract = ETHEREUM_CLIENT.eth.contract(registryABI).at(registryAddress)
    let publicAddress = registryContract.phone2address(req.body.From.toString())
    let balance = web3.fromWei(ETHEREUM_CLIENT.eth.getBalance(publicAddress), 'ether')
    // Add Price information in local Currency
    twiml.message(`Your current balance is ${balance} Eth.`)
  }

  else if (req.body.Body.trim().toLowerCase() === 'send') {
    state[req.body.From] = 'sendRequest'
    twiml.message(
      `Please send the destination phone number and theamount you wish to send,
       in the following format (destination, amount)`)
  }

  else if (state[req.body.From] === 'sendRequest') {
    state[req.body.From] = 'sendConfirm'
    let values = req.body.Body.split(', ')
    transactionState[req.body.From] = values
    // Add price information in Local currency
    twiml.message(
      `You are sending ${values[1]} Ether to ${values[0]}. Please enter your password
       to continue.
      `)
  }
  // Add invalid account check
  // Add invalid balance check
  else if (state[req.body.From] === 'sendConfirm') {
    state[req.body.From] = false
    let privateKey = web3.sha3(SALT + req.body.From + req.body.Body)
    let value = web3.toWei(transactionState[req.body.From][1])
    var senderAddress = '0x' + ethUtil.privateToAddress(privateKey).toString('hex')
    let receiverAddress = registryContract.phone2address(transactionState[req.body.From][0].toString())
    var client = require('twilio')(accountSid, authToken)
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
    client.messages.create({
      to: transactionState[req.body.From][0],
      from: '+12016902660',
      body: `${req.body.From} sent you ${transactionState[req.body.From][1]} Eth`
    }, function (e, m) { })
    twiml.message('Transaction Sent')
  } else {
    state[req.body.From] = false
    twiml.message('Invalid Function')
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
