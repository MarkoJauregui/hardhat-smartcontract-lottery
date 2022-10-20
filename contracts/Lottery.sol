// Functions

// 1- Enter the lottery (Payable)
// 2- Pick a random winner (Random Index in participants array)
// 3- Winner is selected every x minutes Automatically
// Use of Chainlink -> Randomness, Automated execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();

contract Lottery is VRFConsumerBaseV2 {
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
    uint32 callbackGasLimit
  ) VRFConsumerBaseV2(vrfCoordinatorV2) {
    i_entranceFee = entranceFee;
    i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    i_gasLane = gasLane;
    i_subscriptionId = subscriptionId;
    i_callbackGasLimit = callbackGasLimit;
  }

  function enterLottery() public payable {
    if (msg.value < i_entranceFee) {
      revert Lottery__NotEnoughETHEntered();
    }
    s_participants.push(payable(msg.sender));

    // Emit an event when we update a dynamic array
    emit LotteryEnter(msg.sender);
  }

  function requestRandomWinner() external {
    // Request random number
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
}
