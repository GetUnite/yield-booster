// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IAlluoOmnivault {
    struct vaultBalance {
        uint256 vault1Tokens;
        uint256 vault2Tokens;
        uint256 vault3Tokens;
        uint256 vault4Tokens;
    }

    // Swap all tokens to  underlying beefy vault tokens by looping
    // Then initialize the user's vaultBalance
    function deposit(address tokenAddress, uint256 amount) external;

    // Swap all tokens to  underlying beefy vault tokens by looping through. Use the percentage.
    function withdraw(address tokenAddress, uint256 percentage) external;

    // The complex looping logic.
    // function reallocate(
    //     address[] memory newVaults,
    //     uint256[] memory newPercents
    // ) external;
}
