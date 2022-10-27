const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  let vrfCoodrinatorV2Address, subscriptionId
  const vrfCoodrinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")

  if (developmentChains.includes(network.name)) {
    vrfCoodrinatorV2Address = vrfCoodrinatorV2Mock.address
    const transactionResponse = await vrfCoodrinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait(1)
    subscriptionId = transactionReceipt.events[0].args.subId
    // Fund subscription
    await vrfCoodrinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
  } else {
    vrfCoodrinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
    subscriptionId = networkConfig[chainId]["subscriptionId"]
  }

  const entranceFee = networkConfig[chainId]["entranceFee"]
  const gasLane = networkConfig[chainId]["gasLane"]
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
  const interval = networkConfig[chainId]["interval"]
  const args = [
    vrfCoodrinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ]
  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  })

  if (developmentChains.includes(network.name)) {
    await vrfCoodrinatorV2Mock.addConsumer(subscriptionId, lottery.address)

    log("Consumer is added")
  }

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("Verifying...")
    await verify(lottery.address, args)
  }
  console.log("-----------------------------------")
}

module.exports.tags = ["all", "lottery"]
