const { assert } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery", async function () {
      let lottery, vrfCoordinatorVMock
      const chainId = network.config.chainId

      beforeEach(async function () {
        const { deployer } = await getNamedAccounts()
        await deployments.fixture(["all"])
        lottery = await ethers.getContract("Lottery", deployer)
        vrfCoordinatorVMock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
      })

      describe("constructor", async () => {
        it("initializes lottery correctly", async () => {
          const lotteryState = await lottery.getLotteryState()
          const interval = await lottery.getInterval()
          assert.equal(lotteryState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })
    })
