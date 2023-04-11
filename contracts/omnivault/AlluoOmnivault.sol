// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {IAlluoOmnivault} from "./interfaces/IAlluoOmnivault.sol";
import {IExchange} from "./interfaces/IExchange.sol";
import {IBeefyBoost} from "./interfaces/IBeefyBoost.sol";
import {IBeefyVault} from "./interfaces/IBeefyVault.sol";
import {AlluoUpgradeableBase} from "../AlluoUpgradeableBase.sol";

import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "hardhat/console.sol";

contract AlluoOmnivault is AlluoUpgradeableBase, IAlluoOmnivault {
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public underlyingVaultsPercents;
    mapping(address => address) public vaultToBeefyBoost;
    mapping(address => uint256) public lastPricePerFullShare;
    mapping(address => uint256) public adminFees;

    EnumerableSetUpgradeable.AddressSet private activeUsers;
    EnumerableSetUpgradeable.AddressSet private activeUnderlyingVaults;

    IExchange public exchangeAddress;
    address public primaryToken;
    uint256 public feeOnYield;
    address public admin;
    uint256 public lastYieldSkimTimestamp;
    uint256 public skimYieldPeriod;

    modifier enforceYieldSkimming() {
        if (block.timestamp >= lastYieldSkimTimestamp + skimYieldPeriod) {
            skimYieldFeeAndSendToAdmin();
        }
        _;
    }

    function initialize(
        address _exchangeAddress,
        address _primaryToken,
        address[] memory _underlyingVaults,
        uint256[] memory _underlyingVaultsPercents,
        address _admin,
        uint256 _feeOnYield,
        uint256 _skimYieldPeriod
    ) public initializer {
        __AlluoUpgradeableBase_init();
        exchangeAddress = IExchange(_exchangeAddress);
        primaryToken = _primaryToken;
        for (uint256 i = 0; i < _underlyingVaults.length; i++) {
            activeUnderlyingVaults.add(_underlyingVaults[i]);
            underlyingVaultsPercents[
                _underlyingVaults[i]
            ] = _underlyingVaultsPercents[i];
            lastPricePerFullShare[_underlyingVaults[i]] = IBeefyVault(
                _underlyingVaults[i]
            ).getPricePerFullShare();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        admin = _admin;
        feeOnYield = _feeOnYield;
        skimYieldPeriod = _skimYieldPeriod;
        lastYieldSkimTimestamp = block.timestamp;
    }

    function deposit(
        address tokenAddress,
        uint256 amount
    ) external override enforceYieldSkimming {
        // First transfer the toknes to the contract. Then use the exchange to exchange it to the activeUnderlyingVaults
        // Then initialize the user's vaultBalance based on balance before and balance after.
        require(amount > 0, "!GT0");
        IERC20MetadataUpgradeable(tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Swap all into primary token first.
        if (tokenAddress != primaryToken) {
            IERC20MetadataUpgradeable(tokenAddress).approve(
                address(exchangeAddress),
                amount
            );
            amount = exchangeAddress.exchange(
                tokenAddress,
                primaryToken,
                amount,
                0
            );
        }
        _iterativeDeposit(amount, true);
        if (activeUsers.contains(msg.sender) == false) {
            activeUsers.add(msg.sender);
        }
    }

    // Only in primaryTokens
    function _iterativeDeposit(
        uint256 amount,
        bool isDepositor
    ) internal returns (uint256[] memory) {
        uint256 remainingPrimaryTokens = amount;
        uint256[] memory vaultInitialBalances = new uint256[](
            activeUnderlyingVaults.length()
        );
        IERC20MetadataUpgradeable(primaryToken).safeApprove(
            address(exchangeAddress),
            remainingPrimaryTokens
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 vaultPercent = underlyingVaultsPercents[vaultAddress];
            uint256 primaryTokensToSwap = (amount * vaultPercent) / 100;
            vaultInitialBalances[i] = IERC20MetadataUpgradeable(vaultAddress)
                .balanceOf(address(this));
            if (i == activeUnderlyingVaults.length() - 1) {
                primaryTokensToSwap = remainingPrimaryTokens;
            } else {
                remainingPrimaryTokens -= primaryTokensToSwap;
            }

            uint256 newVaultTokens = exchangeAddress.exchange(
                primaryToken,
                vaultAddress,
                primaryTokensToSwap,
                0
            );
            _boostIfApplicable(vaultAddress);
            if (isDepositor) {
                balances[msg.sender][vaultAddress] += newVaultTokens;
            }
        }
        return vaultInitialBalances;
    }

    function _boostIfApplicable(address vaultAddress) internal virtual {
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

    function withdraw(
        address tokenAddress,
        uint256 percentage
    ) external override enforceYieldSkimming returns (uint256 totalTokens) {
        require(percentage > 0, "!GT0");
        require(percentage <= 100, "!LTE100");
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
            totalTokens += exchangeAddress.exchange(
                vaultAddress,
                primaryToken,
                vaultAmount,
                0
            );
            balances[msg.sender][vaultAddress] -= vaultAmount;
        }

        if (percentage == 100) {
            activeUsers.remove(msg.sender);
        }

        if (tokenAddress != primaryToken) {
            IERC20MetadataUpgradeable(primaryToken).safeApprove(
                address(exchangeAddress),
                totalTokens
            );
            totalTokens = exchangeAddress.exchange(
                primaryToken,
                tokenAddress,
                totalTokens,
                0
            );
        }
        IERC20MetadataUpgradeable(tokenAddress).safeTransfer(
            msg.sender,
            totalTokens
        );
    }

    function skimYieldFeeAndSendToAdmin() public {
        if (feeOnYield == 0) {
            return;
        }
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 currentPricePerFullShare = IBeefyVault(vaultAddress)
                .getPricePerFullShare();
            uint256 previousPricePerFullShare = lastPricePerFullShare[
                vaultAddress
            ];

            if (currentPricePerFullShare > previousPricePerFullShare) {
                // Additional yield from reward tokens, only in the LP.
                uint256 additionalYield = ((currentPricePerFullShare -
                    previousPricePerFullShare) *
                    IERC20MetadataUpgradeable(vaultAddress).balanceOf(
                        address(this)
                    )) / 1e18;

                uint256 feeInUnderlyingToken = (additionalYield * feeOnYield) /
                    10000;
                uint256 lpTokensToWithdraw = (feeInUnderlyingToken * 1e18) /
                    currentPricePerFullShare;

                IERC20MetadataUpgradeable(vaultAddress).safeApprove(
                    address(exchangeAddress),
                    lpTokensToWithdraw
                );
                uint256 feeInPrimaryToken = exchangeAddress.exchange(
                    vaultAddress,
                    primaryToken,
                    lpTokensToWithdraw,
                    0
                );
                // Update admin fees mapping
                adminFees[primaryToken] += feeInPrimaryToken;
                // Update user balances
                for (uint256 j = 0; j < activeUsers.length(); j++) {
                    address userAddress = activeUsers.at(j);
                    uint256 userBalance = balances[userAddress][vaultAddress];
                    uint256 userShareBeforeSwap = (userBalance * 1e18) /
                        (IERC20MetadataUpgradeable(vaultAddress).balanceOf(
                            address(this)
                        ) + lpTokensToWithdraw);
                    uint256 userLpFee = (lpTokensToWithdraw *
                        userShareBeforeSwap) / 1e18;
                    balances[userAddress][vaultAddress] =
                        userBalance -
                        userLpFee;
                }
            }
        }

        _updateLastPricePerFullShare();
    }

    function _updateLastPricePerFullShare() internal {
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 currentPricePerFullShare = IBeefyVault(vaultAddress)
                .getPricePerFullShare();
            lastPricePerFullShare[vaultAddress] = currentPricePerFullShare;
        }
    }

    function _processBeefyReward(
        address beefyBoostAddress
    ) internal returns (uint256 rewardAmount) {
        if (beefyBoostAddress != address(0)) {
            address rewardToken = IBeefyBoost(beefyBoostAddress).rewardToken();
            uint256 rewardBalance = IERC20MetadataUpgradeable(rewardToken)
                .balanceOf(address(this));
            IERC20MetadataUpgradeable(rewardToken).safeApprove(
                address(exchangeAddress),
                rewardBalance
            );
            rewardAmount = exchangeAddress.exchange(
                rewardToken,
                primaryToken,
                rewardBalance,
                0
            );
            uint256 fee = (rewardAmount * feeOnYield) / 10000;
            rewardAmount -= fee;
            adminFees[primaryToken] += fee;
        }
    }

    function _swapBoostedRewards() internal returns (uint256) {
        uint256 totalRewards;
        for (uint256 i; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            address beefyBoostAddress = vaultToBeefyBoost[vaultAddress];
            if (beefyBoostAddress != address(0)) {
                IBeefyBoost(beefyBoostAddress).getReward();
            }
            totalRewards += _processBeefyReward(beefyBoostAddress);
        }
        return totalRewards;
    }

    function _unboostIfApplicable(
        address vaultAddress,
        uint256 amount
    ) internal virtual {
        address beefyBoostAddress = vaultToBeefyBoost[vaultAddress];
        if (beefyBoostAddress != address(0)) {
            IBeefyBoost(beefyBoostAddress).withdraw(amount);
        }
    }

    function _unboostAllAndSwapRewards(
        address vaultAddress
    ) internal virtual returns (uint256) {
        address beefyBoostAddress = vaultToBeefyBoost[vaultAddress];
        if (beefyBoostAddress != address(0)) {
            IBeefyBoost(beefyBoostAddress).exit();
        }
        return _processBeefyReward(beefyBoostAddress);
    }

    function _harvestAndCreditUsers() internal {
        uint256 boostedRewards = _swapBoostedRewards();
        if (boostedRewards > 0) {
            uint256[] memory _vaultInitialBalances = _iterativeDeposit(
                boostedRewards,
                false
            );
            for (uint256 i = 0; i < activeUsers.length(); i++) {
                address user = activeUsers.at(i);
                for (uint256 j = 0; j < activeUnderlyingVaults.length(); j++) {
                    address vaultAddress = activeUnderlyingVaults.at(j);
                    uint256 userVaultBalance = balances[user][vaultAddress];
                    uint256 vaultPercentage = (userVaultBalance * 1e18) /
                        _vaultInitialBalances[j];
                    uint256 vaultBalance = IERC20MetadataUpgradeable(
                        vaultAddress
                    ).balanceOf(address(this));
                    uint256 newUserVaultTokens = (vaultBalance *
                        vaultPercentage) / 1e18;
                    balances[user][vaultAddress] = newUserVaultTokens;
                }
            }
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
        skimYieldFeeAndSendToAdmin();
        if (newVaults.length == 0) {
            _harvestAndCreditUsers();
            return;
        }

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
        IERC20MetadataUpgradeable(primaryToken).safeApprove(
            address(exchangeAddress),
            remainingPrimaryTokens
        );
        for (uint256 i = 0; i < newVaults.length; i++) {
            uint256 percent = newPercents[i];
            uint256 primaryTokensToSwap = (totalPrimaryTokens * percent) / 100;
            if (i == newVaults.length - 1) {
                primaryTokensToSwap = remainingPrimaryTokens;
            } else {
                remainingPrimaryTokens -= primaryTokensToSwap;
            }
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
            lastPricePerFullShare[newVaults[i]] = IBeefyVault(newVaults[i])
                .getPricePerFullShare();
            _boostIfApplicable(newVaultAddress);
        }
    }

    function claimAdminFees() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 feeAmount = adminFees[primaryToken];
        require(feeAmount > 0, "NO_FEES");
        adminFees[primaryToken] = 0;
        IERC20MetadataUpgradeable(primaryToken).safeTransfer(
            msg.sender,
            feeAmount
        );
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

    function getActiveUnderlyingVaults()
        external
        view
        returns (address[] memory)
    {
        address[] memory vaults = new address[](
            activeUnderlyingVaults.length()
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            vaults[i] = activeUnderlyingVaults.at(i);
        }
        return vaults;
    }

    function getUnderlyingVaultsPercents()
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory percents = new uint256[](
            activeUnderlyingVaults.length()
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            percents[i] = underlyingVaultsPercents[vaultAddress];
        }
        return percents;
    }

    function getActiveUsers() external view returns (address[] memory) {
        address[] memory users = new address[](activeUsers.length());
        for (uint256 i = 0; i < activeUsers.length(); i++) {
            users[i] = activeUsers.at(i);
        }
        return users;
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

    function setFeeOnYield(
        uint256 _feeOnYield
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeOnYield = _feeOnYield;
    }

    function setSkimYieldPeriod(
        uint256 _skimYieldPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        skimYieldPeriod = _skimYieldPeriod;
    }
}
