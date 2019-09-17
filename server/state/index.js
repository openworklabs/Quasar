const { List } = require('immutable')
// const ethereum = require('../ethereum')

const smartContractSchema = {
  address: val => typeof val === 'string',
  network: val =>
    val &&
    (val.toLowerCase() === 'rinkeby' ||
      val.toLowerCase() === 'mainnet' ||
      val.toLowerCase() === 'localhost'),
  abi: val => typeof val === 'object'
}

const findInvalidSmartContractFields = smartContractObj =>
  Object.entries(smartContractSchema).reduce((errors, [property, validate]) => {
    if (!validate(smartContractObj[property])) {
      errors.push(`${property}`)
    }
    return errors
  }, [])

let smartContracts
const initSmartContracts = () => {
  smartContracts = List()
}

const isDuplicateSmartContract = address =>
  smartContracts.find(smartContractObj => smartContractObj.address === address)

const unsubscribe = address => {
  const contractIndex = smartContracts.findIndex(i => i.address === address)
  smartContracts.get(contractIndex).listener.unsubscribe()
  smartContracts = smartContracts.delete(contractIndex)
}

const addSmartContract = async smartContractObj => {
  const invalidFields = findInvalidSmartContractFields(smartContractObj)
  if (invalidFields.length > 0) {
    throw new Error(
      `the following fields are missing or invalid: ${invalidFields.join(', ')}`
    )
  }
  if (isDuplicateSmartContract(smartContractObj.address)) {
    throw new Error('already listening to the contract at this address')
  }

  // const contract = ethereum.getContract(smartContractObj)
  // const listener = ethereum.registerWatcher(contract)
  // smartContractObj.listener = listener
  smartContracts = smartContracts.push(smartContractObj)
}

const getSmartContracts = () => {
  return smartContracts.toArray()
}

initSmartContracts()

module.exports = {
  getSmartContracts,
  addSmartContract,
  initSmartContracts,
  unsubscribe
}
