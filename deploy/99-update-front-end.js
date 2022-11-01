const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONTEND_ADDRESSES_FILE = "../nextjs-lottery-fcc/constants/contractAddresses.json"
const FRONTEND_ABI_FILE = "../nextjs-lottery-fcc/constants/abi.json"

module.exports = async function () {
  if (process.env.UPDATE_FRONTEND) {
    console.log("Updating Front End...")
    updateContractAddresses()
    updateAbi()
  }
}

async function updateContractAddresses() {
  const lottery = await ethers.getContract("Lottery")
  const chainId = network.config.chainId.toString()
  const currentAddress = await JSON.parse(fs.readFileSync(FRONTEND_ADDRESSES_FILE, "utf8"))
  if (chainId in currentAddress) {
    if (!currentAddress[chainId].includes(lottery.address)) {
      currentAddress[chainId].push(lottery.address)
    }
  }
  {
    currentAddress[chainId] = [lottery.address]
  }
  fs.writeFileSync(FRONTEND_ADDRESSES_FILE, JSON.stringify(currentAddress))
}

async function updateAbi() {
  const lottery = await ethers.getContract("Lottery")
  fs.writeFileSync(FRONTEND_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json))
}

module.exports.tags = ["all", "frontend"]
