const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery", async function () {
      let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        lottery = await ethers.getContract("Lottery", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        lotteryEntranceFee = await lottery.getEntranceFee()
        interval = await lottery.getInterval()
      })

      describe("constructor", async () => {
        it("initializes lottery correctly", async () => {
          const lotteryState = await lottery.getLotteryState()
          assert.equal(lotteryState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enterLottery", async () => {
        it("revert when you don't pay enough", async () => {
          await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughETHEntered")
        })

        it("stores participants when they enter", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          const enteredParticipant = await lottery.getParticipants(0)
          assert.equal(enteredParticipant, deployer)
        })

        it("emits event on enter", async () => {
          await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
            lottery,
            "LotteryEnter"
          )
        })

        it("does NOT allow entrance when lottery state is calculating", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          // Pretend to be Chainlink keeper
          await lottery.performUpkeep([]) //state should now be CALCULATING
          await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.be.revertedWith(
            "LotteryState__NotOpen"
          )
        })
      })
    })
