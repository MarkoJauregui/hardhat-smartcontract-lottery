// Functions

// 1- Enter the lottery (Payable)
// 2- Pick a random winner (Random Index in participants array)
// 3- Winner is selected every x minutes Automatically
// Use of Chainlink -> Randomness, Automated execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error LotteryState__NotOpen();
error Lottery__UpKeepNotNeeded(
  uint256 currentBalance,
  uint256 numParticipants,
  uint256 lotteryState
);

/** @title Sample Lottery Contract
 * @author Marko Jauregui
 * @notice creates an untamperable smart contract
 * @dev Uses Chainlink VRF and Chainlink Keepers
 */

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
  // Types
  // --------------------------------------------------
  enum LotteryState {
    OPEN,
    CALCULATING
  }

  // State Variables
  // --------------------------------------------------
  uint256 private immutable i_entranceFee;
  address payable[] private s_participants;
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
  bytes32 private immutable i_gasLane;
  uint64 private immutable i_subscriptionId;
  uint16 private constant REQUEST_CONFIRMATIONS = 3;
  uint32 private immutable i_callbackGasLimit;
  uint32 private constant NUM_WORDS = 1;

  // Lottery Variables
  // --------------------------------------------------
  address private s_recentWinner;
  LotteryState private s_lotteryState;
  uint256 private s_lastTimeStamp;
  uint256 private immutable i_interval;

  // Events (should be named the reverse of the Function they want to be used in)
  event LotteryEnter(address indexed participant);
  event RequestedLotteryWinner(uint256 indexed requestId);
  event WinnerPicked(address indexed winner);

  // Functions
  // --------------------------------------------------
  constructor(
    address vrfCoordinatorV2,
    uint256 entranceFee,
    bytes32 gasLane,
    uint64 subscriptionId,
    uint32 callbackGasLimit,
    uint256 interval
  ) VRFConsumerBaseV2(vrfCoordinatorV2) {
    i_entranceFee = entranceFee;
    i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    i_gasLane = gasLane;
    i_subscriptionId = subscriptionId;
    i_callbackGasLimit = callbackGasLimit;
    s_lotteryState = LotteryState.OPEN;
    s_lastTimeStamp = block.timestamp;
    i_interval = interval;
  }

  function enterLottery() public payable {
    if (msg.value < i_entranceFee) {
      revert Lottery__NotEnoughETHEntered();
    }
    if (s_lotteryState != LotteryState.OPEN) {
      revert LotteryState__NotOpen();
    }
    s_participants.push(payable(msg.sender));

    // Emit an event when we update a dynamic array
    emit LotteryEnter(msg.sender);
  }

  /**
   * @dev This is the function that ChainLink keeper nodes call
   * they look for bool param to return true
   * 1. Time interval should have passed
   * 2. Lottery should at least have 1 player and some ETH
   * 3. Subscription should be funded with ETH
   * 4. The lottery should be in "Open" state
   */
  function checkUpkeep(
    bytes memory /*checkData*/
  )
    public
    override
    returns (
      bool upkeepNeeded,
      bytes memory /*performData*/
    )
  {
    bool isOpen = (LotteryState.OPEN == s_lotteryState);
    bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
    bool hasParticipants = (s_participants.length > 0);
    bool hasBalance = address(this).balance > 0;
    upkeepNeeded = (isOpen && timePassed && hasParticipants && hasBalance);
  }

  function performUpkeep(
    bytes calldata /* perfomData */
  ) external override {
    (bool upkeepNeeded, ) = checkUpkeep("");
    if (!upkeepNeeded) {
      revert Lottery__UpKeepNotNeeded(
        address(this).balance,
        s_participants.length,
        uint256(s_lotteryState)
      );
    }
    // Request random number
    s_lotteryState = LotteryState.CALCULATING;
    uint256 requestId = i_vrfCoordinator.requestRandomWords(
      i_gasLane,
      i_subscriptionId,
      REQUEST_CONFIRMATIONS,
      i_callbackGasLimit,
      NUM_WORDS
    );
    emit RequestedLotteryWinner(requestId);
  }

  function fulfillRandomWords(
    uint256, /*requestId*/
    uint256[] memory randomWords
  ) internal override {
    uint256 indexOfWinner = randomWords[0] % s_participants.length;
    address payable recentWinner = s_participants[indexOfWinner];
    s_recentWinner = recentWinner;
    s_lotteryState = LotteryState.OPEN;
    s_participants = new address payable[](0);
    s_lastTimeStamp = block.timestamp;
    (bool success, ) = recentWinner.call{value: address(this).balance}("");
    if (!success) {
      revert Lottery__TransferFailed();
    }
    emit WinnerPicked(recentWinner);
  }

  // View/Pure functions
  // --------------------------------------------------
  function getEntranceFee() public view returns (uint256) {
    return i_entranceFee;
  }

  function getParticipants(uint256 i) public view returns (address) {
    return s_participants[i];
  }

  function getRecentWinner() public view returns (address) {
    return s_recentWinner;
  }

  function getLotteryState() public view returns (LotteryState) {
    return s_lotteryState;
  }

  function getNumWords() public pure returns (uint256) {
    return NUM_WORDS;
  }

  function getNumberOfParticipants() public view returns (uint256) {
    return s_participants.length;
  }

  function getLatestTimestamp() public view returns (uint256) {
    return s_lastTimeStamp;
  }

  function getRequestConfirmations() public pure returns (uint256) {
    return REQUEST_CONFIRMATIONS;
  }
}
