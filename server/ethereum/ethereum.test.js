const Web3 = require('web3')
const {
  registerListenWatcher,
  registerPinWatcher,
  registerStopListeningWatcher,
  handleListenEvent,
  handlePinHashEvent,
  getContract
} = require('./')

const ipfsWrapper = require('../ipfs')
const smartContracts = require('../state')
const { demoSmartContractJson1 } = require('../../mockData')
const accounts = require('../../accounts.json')
const storageJSON = require('../../build/contracts/Storage.json')
const listenerJSON = require('../../build/contracts/Listener.json')

let web3
let contract
let listenerContract
let node

beforeAll(() => {
  web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'))
  contract = new web3.eth.Contract(
    demoSmartContractJson1.abi,
    demoSmartContractJson1.address
  )

  listenerContract = new web3.eth.Contract(
    listenerJSON.abi,
    listenerJSON.networks['123'].address
  )

  registerStopListeningWatcher(listenerContract)
  registerListenWatcher(listenerContract)

  const ipfs = ipfsWrapper({
    host: process.env.IPFS_NODE_HOST ? process.env.IPFS_NODE_HOST : 'localhost',
    port: '5002',
    protocol: process.env.IPFS_NODE_PROTOCOL
      ? process.env.IPFS_NODE_PROTOCOL
      : 'http',
    headers: null
  })

  node = ipfs.node
})

beforeEach(async () => {
  let pins = await node.pin.ls()

  async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array)
    }
  }

  await asyncForEach(pins, async item => {
    try {
      await node.pin.rm(item.hash)
    } catch (error) {
      console.error('Error removing pin: ', error)
    }
  })

  pins = await node.pin.ls()
  if (pins.length > 0) throw new Error("Pins weren't removed properly.")

  smartContracts.clear()
})

afterAll(() => {
  web3.currentProvider.connection.close()
})

test(`emitting listen event from listener, then emittting pin event
from pinning contract (without registering pinner) pins file`, async done => {
  const testKey = web3.utils.fromAscii('testKey')
  const dag = { testKey: 'testVal' }
  const hash = await node.dag.put(dag)

  const emitPinEventAndCheck = () => {
    contract.methods
      .registerData(testKey, hash.toBaseEncodedString())
      .send({ from: accounts[0] }, () => {
        setTimeout(async () => {
          const pins = await node.pin.ls()
          const match = pins.find(item => {
            return item.hash === hash.toBaseEncodedString()
          })
          expect(match).toBeDefined()
          done()
        }, 2000)
      })
  }

  await listenerContract.methods
    .unsubscribeContract(demoSmartContractJson1.address)
    .send({ from: accounts[0] }, () => {
      setTimeout(() => {}, 1000)
    })

  listenerContract.methods
    .listenToContract(demoSmartContractJson1.address)
    .send({ from: accounts[0] }, () => {
      setTimeout(() => {
        emitPinEventAndCheck()
      }, 2000)
    })
})

test('watcher pins file from registerData function', async done => {
  const testKey = web3.utils.fromAscii('testKey')
  const dag = { testKey: 'testVal' }
  const hash = await node.dag.put(dag)

  const pins = await node.pin.ls()
  const match = pins.find(item => {
    return item.hash === hash.toBaseEncodedString()
  })
  expect(match).toBeUndefined()

  await listenerContract.methods
    .unsubscribeContract(demoSmartContractJson1.address)
    .send({ from: accounts[0] }, () => {
      setTimeout(() => {}, 1000)
    })

  registerPinWatcher(contract)
  contract.methods
    .registerData(testKey, hash.toBaseEncodedString())
    .send({ from: accounts[0] }, () => {
      setTimeout(async () => {
        const pins = await node.pin.ls()
        const match = pins.find(item => {
          return item.hash === hash.toBaseEncodedString()
        })
        expect(match).toBeDefined()
        done()
      }, 2000)
    })
})

test('firing a listen event adds a new contract to listen to into state', async done => {
  const newSmartContract = {
    address: demoSmartContractJson1.address,
    abi: storageJSON.abi
  }

  listenerContract.methods
    .listenToContract(demoSmartContractJson1.address)
    .send({ from: accounts[0] }, () => {
      setTimeout(() => {
        expect(smartContracts.get()).toMatchObject([newSmartContract])
        done()
      }, 2000)
    })
})

test('handleListenEvent adds smart contract to state', async done => {
  const newSmartContract = {
    address: demoSmartContractJson1.address,
    abi: storageJSON.abi
  }
  const eventObj = {
    returnValues: { contractAddress: demoSmartContractJson1.address }
  }

  await handleListenEvent(null, eventObj)
  expect(smartContracts.get()).toMatchObject([newSmartContract])
  done()
})
test('handlePinHashEvent pins file of cid it was passed', async done => {
  const dag = { secondTestKey: 'secondTestVal' }
  const hash = await node.dag.put(dag)
  const eventObj = {
    returnValues: {
      cid: hash.toBaseEncodedString()
    }
  }

  const res = await handlePinHashEvent(null, eventObj)
  expect(res[0].hash).toBe(hash.toBaseEncodedString())
  done()
})

test('handlePinHashEvent throws error with empty params', async done => {
  await expect(handlePinHashEvent()).rejects.toThrow()
  done()
})

test('getContract returns a contract', async done => {
  const contract = getContract(
    demoSmartContractJson1,
    demoSmartContractJson1.address
  )
  expect(contract._address).toBe(demoSmartContractJson1.address)
  done()
})

test('getContract throws when an invalid contract is passed', async done => {
  demoSmartContractJson1.address = '0x7505462c30102eBCDA555446c3807362AeFEfc8r'
  const badCall = () => {
    return getContract(
      demoSmartContractJson1,
      '0x7505462c30102eBCDA555446c3807362AeFEfc8r'
    )
  }

  expect(badCall).toThrow()
  done()
})

// Uncomment this when timeout in ipfs.dag.get is working. Will need to adjust jest.setTimeout.Timeout past the dag.get timeout time.

// test('handlePinHashEvent throws an error after X seconds if the cid is unavailable on the network', async done => {
//   const invalidEventObj = {
//     returnValues: {
//       cid: 'bafyreigunyjtx4oyopevaygyizasvgwitymlcnlwitlkiszl4krdpofpro'
//     }
//   }

//   try {
//     await handlePinHashEvent(null, invalidEventObj)
//     expect(true).toBe(false)
//     done()
//   } catch (error) {
//     expect(error).toBeDefined()
//     done()
//   }
// })
