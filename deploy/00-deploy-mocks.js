const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") // 0.25 LINK per Request
const GAS_PRICE_LINK = 1e9 //calculated value based on the price of the chain.

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  const args = [BASE_FEE, GAS_PRICE_LINK]

  if (chainId == 31337) {
    console.log("Local network detected! Deploying mocks...")
    // Deploy mock vrfcoodrinator...
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    })
    console.log("Mocks Deployed!")
    console.log("---------------------------------------")
  }
}

module.exports.tags = ["all", "mocks"]
