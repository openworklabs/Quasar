const mongoose = require('mongoose')
const {
  handleListenEvent,
  handlePinHashEvent,
  registerPinWatcher,
  registerListenWatcher
} = require('./')

const { node } = require('../ipfs')
const {
  demoListenerContractJson,
  demoSmartContractJson1,
  demoSmartContractJson2
} = require('../../mockData')
const { ListenerContractToPoll, SmartContractToPoll, Pin } = require('../db')
const Scheduler = require('../scheduler')
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const mineBlocks = require('../../utils/mineBlocks')(web3)
const sleep = require('../../utils/sleep')

beforeAll(async done => {
  await mongoose.connect(process.env.DB_URL || 'mongodb://localhost/test', {
    useNewUrlParser: true
  })
  mongoose.connection.db.dropDatabase()
  done()
})

beforeEach(async () => {
  await SmartContractToPoll.deleteMany({})
})

describe('unit tests', () => {
  describe('registerListenWatcher', () => {
    test('registerListenWatcher returns an instance of the scheduler', () => {
      const listenerWatcher = registerListenWatcher(() => {})
      listenerWatcher.stop()
      expect(listenerWatcher instanceof Scheduler).toBe(true)
    })

    test('registerListenWatcher polls database and updates last polled block on each contract', async done => {
      registerListenWatcher()
      const listenerContract = await ListenerContractToPoll.create({
        address: demoListenerContractJson.address,
        lastPolledBlock: 0
      })

      await mineBlocks(1)
      await sleep(500)

      const updatedContract = await ListenerContractToPoll.findById(
        listenerContract._id
      )

      expect(updatedContract.lastPolledBlock).toBeGreaterThan(0)
      done()
    })
  })

  describe('registerPinWatcher', () => {
    test('registerPinWatcher returns an instance of the scheduler', () => {
      const pinWatcher = registerPinWatcher(() => {})
      pinWatcher.stop()
      expect(pinWatcher instanceof Scheduler).toBe(true)
    })

    test('registerPinWatcher polls database and updates last polled block on each contract', async done => {
      registerPinWatcher()
      const firstContractToPoll = await SmartContractToPoll.create({
        address: demoSmartContractJson1.address,
        lastPolledBlock: 0,
        sizeOfPinnedData: 0
      })

      const secondContractToPoll = await SmartContractToPoll.create({
        address: demoSmartContractJson2.address,
        lastPolledBlock: 0,
        sizeOfPinnedData: 0
      })

      await mineBlocks(1)
      await sleep(500)

      const updatedFirstContractInDB = await SmartContractToPoll.findById(
        firstContractToPoll._id
      )
      const updatedSecondContractInDB = await SmartContractToPoll.findById(
        secondContractToPoll._id
      )
      expect(updatedFirstContractInDB.lastPolledBlock).toBeGreaterThan(0)
      expect(updatedSecondContractInDB.lastPolledBlock).toBeGreaterThan(0)
      done()
    })
  })

  describe('handlers', () => {
    test('handleListenEvent adds smart contract to database when event type is "Listen"', async done => {
      const eventObj = {
        event: 'Listen',
        returnValues: { contractAddress: demoSmartContractJson1.address }
      }

      await handleListenEvent(eventObj)
      const smartContractToPoll = await SmartContractToPoll.findOne({
        address: demoSmartContractJson1.address
      })
      expect(smartContractToPoll.address).toBe(demoSmartContractJson1.address)
      expect(smartContractToPoll.sizeOfPinnedData).toBe(0)
      expect(smartContractToPoll.lastPolledBlock).toBe(0)
      done()
    })

    test('handleListenEvent removes smart contract from database when event type is "StopListening"', async done => {
      await SmartContractToPoll.create({
        address: demoSmartContractJson1.address,
        lastPolledBlock: 0,
        sizeOfPinnedData: 0
      })

      const eventObj = {
        event: 'StopListening',
        returnValues: { contractAddress: demoSmartContractJson1.address }
      }

      await handleListenEvent(eventObj)
      const smartContractToPoll = await SmartContractToPoll.findOne({
        address: demoSmartContractJson1.address
      })
      expect(smartContractToPoll).toBe(null)
      done()
    })

    test('handlePinHashEvent removes file from database by cid', async done => {
      const dagA = { firstTestKey: 'firstTestVal' }
      const cidA = await node.dag.put(dagA)
      const dagB = { secondTestKey: 'secondTestVal' }
      const cidB = await node.dag.put(dagB)

      const eventObj = {
        returnValues: {
          cid: cidA.toBaseEncodedString()
        }
      }

      await Pin.create({
        size: 100,
        cid: cidA.toBaseEncodedString(),
        time: new Date()
      })

      await Pin.create({
        size: 100,
        cid: cidB.toBaseEncodedString(),
        time: new Date()
      })

      await handlePinHashEvent(eventObj)

      const removedCid = await Pin.find({
        cid: cidA.toBaseEncodedString()
      })
      expect(removedCid.length).toBe(0)
      const storedCid = await Pin.find({ cid: cidB.toBaseEncodedString() })
      expect(storedCid.length).toBe(1)
      done()
    })
  })
})
