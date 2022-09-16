// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface ICurvePool {
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint) external returns (uint256); 
    function token() external returns (address);
}