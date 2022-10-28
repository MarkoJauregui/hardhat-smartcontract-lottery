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

      describe("constructor", () => {
        it("initializes lottery correctly", async () => {
          const lotteryState = await lottery.getLotteryState()
          assert.equal(lotteryState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enterLottery", () => {
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

      describe("checkUpkeep", () => {
        it("returns false if participants have NOT sent ETH", async () => {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert(!upkeepNeeded)
        })

        it("returns false if lottery is NOT open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          await lottery.performUpkeep([]) //state should now be CALCULATING
          const lotteryState = await lottery.getLotteryState()
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert.equal(lotteryState.toString(), "1")
          assert.equal(upkeepNeeded, false)
        })

        it("returns false if NOT enough time has passed", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 3])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
          assert(!upkeepNeeded)
        })

        it("returns true if enough time has passed, has participants, eth and is OPEN", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", () => {
        it("can only run if checkUpkeep is true", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const tx = await lottery.performUpkeep([])
          assert(tx)
        })

        it("reverts when checkUpkeep is false", async () => {
          await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpKeepNotNeeded")
        })

        it("updates the lottery state, emits and events, calls the vrf coordinator", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const txResponse = await lottery.performUpkeep([])
          const txReceipt = await txResponse.wait(1)
          const requestId = txReceipt.events[1].args.requestId
          const lotteryState = await lottery.getLotteryState()
          assert(requestId.toNumber() > 0)
          assert.equal(lotteryState.toString(), "1")
        })
      })

      describe("fulfillRandomWords", () => {
        beforeEach(async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
        })

        it("can only be called after performUpkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
          ).to.be.revertedWith("nonexistent request")
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
          ).to.be.revertedWith("nonexistent request")
        })

        it("picks a winner, resets the Lottery and sends money to winner", async () => {
          // Connect participants to Lottery
          const additionalEntrants = 3
          const startingAccountIndex = 1 //because the Deployer starts at 0
          const accounts = await ethers.getSigners()
          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
            const accountConnectedLottery = lottery.connect(accounts[i])
            await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee })
          }
          const startingTimeStamp = await lottery.getLatestTimestamp()

          // performUpkeep (mock being Chainlink keepers)
          // fulfillRandomWords (mock being Chainlink VRF)
          // wait for fulfillRandomWords to be called

          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              console.log("WinnerPicked event found!")
              try {
                const recentWinner = await lottery.getRecentWinner()
                console.log(`Winner is ${recentWinner}`)
                const lotteryState = await lottery.getLotteryState()
                const endingTimeStamp = await lottery.getLatestTimestamp()
                const numParticipants = await lottery.getNumberOfParticipants()
                const winnerEndingBalance = await accounts[1].getBalance()

                assert.equal(numParticipants.toString(), "0")
                assert.equal(lotteryState.toString(), "0")

                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance
                    .add(lotteryEntranceFee.mul(additionalEntrants).add(lotteryEntranceFee))
                    .toString()
                )
                assert(endingTimeStamp > startingTimeStamp)
              } catch (e) {
                reject(e)
              }
              resolve()
            })
            const tx = await lottery.performUpkeep([])
            const txReceipt = await tx.wait(1)
            const winnerStartingBalance = await accounts[1].getBalance()
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              lottery.address
            )
          })
        })
      })
    })
