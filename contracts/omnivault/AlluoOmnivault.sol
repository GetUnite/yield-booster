// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {IAlluoOmnivault} from "./interfaces/IAlluoOmnivault.sol";
import {IExchange} from "./interfaces/IExchange.sol";
import {IBeefyBoost} from "./interfaces/IBeefyBoost.sol";

import {AlluoUpgradeableBase} from "../AlluoUpgradeableBase.sol";

import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

contract AlluoOmnivault is AlluoUpgradeableBase, IAlluoOmnivault {
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public underlyingVaultsPercents;

    EnumerableSetUpgradeable.AddressSet private activeUsers;
    EnumerableSetUpgradeable.AddressSet private activeUnderlyingVaults;
    mapping(address => address) public vaultToBeefyBoost;

    IExchange public exchangeAddress;
    address public primaryToken;

    function initialize(
        address _exchangeAddress,
        address _primaryToken,
        address[] memory _underlyingVaults,
        uint256[] memory _underlyingVaultsPercents
    ) public initializer {
        __AlluoUpgradeableBase_init();
        exchangeAddress = IExchange(_exchangeAddress);
        primaryToken = _primaryToken;
        for (uint256 i = 0; i < _underlyingVaults.length; i++) {
            activeUnderlyingVaults.add(_underlyingVaults[i]);
            underlyingVaultsPercents[
                _underlyingVaults[i]
            ] = _underlyingVaultsPercents[i];
        }
    }

    function deposit(address tokenAddress, uint256 amount) external override {
        // First transfer the toknes to the contract. Then use the exchange to exchange it to the activeUnderlyingVaults
        // Then initialize the user's vaultBalance based on balance before and balance after.
        IERC20MetadataUpgradeable(tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 vaultPercent = underlyingVaultsPercents[vaultAddress];
            uint256 vaultAmount = (amount * vaultPercent) / 100;
            IERC20MetadataUpgradeable(tokenAddress).safeApprove(
                address(exchangeAddress),
                vaultAmount
            );
            uint256 newVaultTokens = exchangeAddress.exchange(
                tokenAddress,
                vaultAddress,
                vaultAmount,
                0
            );
            _boostIfApplicable(vaultAddress);

            balances[msg.sender][vaultAddress] += newVaultTokens;
        }
    }

    function _boostIfApplicable(address vaultAddress) internal {
        address beefyBoostAddress = vaultToBeefyBoost[vaultAddress];
        IERC20MetadataUpgradeable vaultToken = IERC20MetadataUpgradeable(
            vaultAddress
        );
        if (beefyBoostAddress != address(0)) {
            vaultToken.approve(
                beefyBoostAddress,
                vaultToken.balanceOf(address(this))
            );
            IBeefyBoost(beefyBoostAddress).stake(
                vaultToken.balanceOf(address(this))
            );
        }
    }

    function _unboostIfApplicable(
        address vaultAddress,
        uint256 amount
    ) internal {
        address beefyBoostAddress = vaultToBeefyBoost[vaultAddress];
        if (beefyBoostAddress != address(0)) {
            IBeefyBoost(beefyBoostAddress).withdraw(amount);
        }
    }

    function _unboostAllAndSwapRewards(
        address vaultAddress
    ) internal returns (uint256) {
        address beefyBoostAddress = vaultToBeefyBoost[vaultAddress];
        if (beefyBoostAddress != address(0)) {
            IBeefyBoost(beefyBoostAddress).exit();

            // Get the reward token
            address rewardToken = IBeefyBoost(beefyBoostAddress).rewardToken();
            // Swap it all to the primaryToken and return it
            IERC20MetadataUpgradeable(rewardToken).safeApprove(
                address(exchangeAddress),
                IERC20MetadataUpgradeable(rewardToken).balanceOf(address(this))
            );
            return
                exchangeAddress.exchange(
                    rewardToken,
                    primaryToken,
                    IERC20MetadataUpgradeable(rewardToken).balanceOf(
                        address(this)
                    ),
                    0
                );
        }
        return 0;
    }

    function withdraw(
        address tokenAddress,
        uint256 percentage
    ) external override {
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 vaultAmount = (balances[msg.sender][vaultAddress] *
                percentage) / 100;
            // If the vault token is inside the beefy boost, exit that first
            _unboostIfApplicable(vaultAddress, vaultAmount);
            IERC20MetadataUpgradeable(vaultAddress).safeApprove(
                address(exchangeAddress),
                vaultAmount
            );
            uint256 newVaultTokens = exchangeAddress.exchange(
                vaultAddress,
                tokenAddress,
                vaultAmount,
                0
            );
            balances[msg.sender][vaultAddress] -= vaultAmount;
            IERC20MetadataUpgradeable(tokenAddress).safeTransfer(
                msg.sender,
                newVaultTokens
            );
        }
        // If the percentage is 100, then remove the user from the activeUsers
        if (percentage == 100) {
            activeUsers.remove(msg.sender);
        }
    }

    function redistribute(
        address[] memory newVaults,
        uint256[] memory newPercents,
        address[] memory boostVaults
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            newVaults.length == newPercents.length,
            "Mismatch in vaults and percents lengths"
        );

        // Step 1: Swap each of the omnivault's tokens to the primary token and note down.
        uint256 totalPrimaryTokens;
        uint256[] memory primaryTokensList = new uint256[](
            activeUnderlyingVaults.length()
        );
        uint256[] memory vaultInitialBalances = new uint256[](
            activeUnderlyingVaults.length()
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 vaultBalance = IERC20MetadataUpgradeable(vaultAddress)
                .balanceOf(address(this));
            vaultInitialBalances[i] = vaultBalance;
            uint256 primaryTokens = _unboostAllAndSwapRewards(vaultAddress);
            IERC20MetadataUpgradeable(vaultAddress).safeApprove(
                address(exchangeAddress),
                vaultBalance
            );
            primaryTokens += exchangeAddress.exchange(
                vaultAddress,
                primaryToken,
                vaultBalance,
                0
            );
            totalPrimaryTokens += primaryTokens;
            primaryTokensList[i] = primaryTokens;
        }

        // Step 2: Swap all of these primary tokens to the correct proportion of new moo tokens.
        uint256 remainingPrimaryTokens = totalPrimaryTokens;
        for (uint256 i = 0; i < newVaults.length; i++) {
            uint256 percent = newPercents[i];
            uint256 primaryTokensToSwap = (totalPrimaryTokens * percent) / 100;
            if (i == newVaults.length - 1) {
                primaryTokensToSwap = remainingPrimaryTokens;
            } else {
                remainingPrimaryTokens -= primaryTokensToSwap;
            }
            IERC20MetadataUpgradeable(primaryToken).safeApprove(
                address(exchangeAddress),
                primaryTokensToSwap
            );
            exchangeAddress.exchange(
                primaryToken,
                newVaults[i],
                primaryTokensToSwap,
                0
            );
        }
        // Step 3: Loop through every user and calculate how much new vault tokens they are entitled to.
        for (uint256 i = 0; i < activeUsers.length(); i++) {
            address user = activeUsers.at(i);

            uint256 userTotalPrimaryTokens;
            for (uint256 j = 0; j < activeUnderlyingVaults.length(); j++) {
                address vaultAddress = activeUnderlyingVaults.at(j);
                uint256 userVaultBalance = balances[user][vaultAddress];
                uint256 vaultPercentage = (userVaultBalance * 1e18) /
                    vaultInitialBalances[j];
                uint256 userPrimaryTokens = (primaryTokensList[j] *
                    vaultPercentage) / 1e18;
                userTotalPrimaryTokens += userPrimaryTokens;
                delete balances[user][vaultAddress];
            }

            uint256 userPercentage = (userTotalPrimaryTokens * 1e18) /
                totalPrimaryTokens;
            for (uint256 j = 0; j < newVaults.length; j++) {
                address newVaultAddress = newVaults[j];
                uint256 newVaultBalance = IERC20MetadataUpgradeable(
                    newVaultAddress
                ).balanceOf(address(this));
                uint256 newUserVaultTokens = (newVaultBalance *
                    userPercentage) / 1e18;
                balances[user][newVaultAddress] = newUserVaultTokens;
            }
        }

        // Step 4: Update state variables and remove old vault balance values.
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            activeUnderlyingVaults.remove(vaultAddress);
            underlyingVaultsPercents[vaultAddress] = 0;
        }
        for (uint256 i = 0; i < newVaults.length; i++) {
            address newVaultAddress = newVaults[i];
            activeUnderlyingVaults.add(newVaultAddress);
            underlyingVaultsPercents[newVaultAddress] = newPercents[i];
            if (boostVaults[i] != address(0)) {
                vaultToBeefyBoost[newVaultAddress] = boostVaults[i];
            }
            _boostIfApplicable(newVaultAddress);
        }
    }

    // Return the balance of a user in a vault by looping through the active vaults
    function balanceOf(
        address user
    )
        external
        view
        returns (address[] memory vaults, uint256[] memory vaultBalances)
    {
        vaults = new address[](activeUnderlyingVaults.length());
        vaultBalances = new uint256[](activeUnderlyingVaults.length());
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            vaults[i] = vaultAddress;
            vaultBalances[i] = balances[user][vaultAddress];
        }
    }

    // Admin functions
    function setExchangeAddress(
        address _exchangeAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        exchangeAddress = IExchange(_exchangeAddress);
    }

    function setPrimaryToken(
        address _primaryToken
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        primaryToken = _primaryToken;
    }
}
