// Functions

// 1- Enter the lottery (Payable)
// 2- Pick a random winner (Random Index in participants array)
// 3- Winner is selected every x minutes Automatically
// Use of Chainlink -> Randomness, Automated execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

error Lottery__NotEnoughETHEntered();

contract Lottery {
  // State Variables
  uint256 private immutable i_entranceFee;
  address payable[] private s_participants;

  // Events (should be named the reverse of the Function they want to be used in)
  event LotteryEnter(address indexed participant);

  constructor(uint256 entranceFee) {
    i_entranceFee = entranceFee;
  }

  function enterLottery() public payable {
    if (msg.value < i_entranceFee) {
      revert Lottery__NotEnoughETHEntered();
    }
    s_participants.push(payable(msg.sender));

    // Emit an event when we update a dynamic array
    emit LotteryEnter(msg.sender);
  }

  // function pickRandomWinner() {}

  function getEntranceFee() public view returns (uint256) {
    return i_entranceFee;
  }

  function getParticipants(uint256 i) public view returns (address) {
    return s_participants[i];
  }
}
