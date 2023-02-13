//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./interfaces/IAlluoPool.sol";

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./interfaces/IExchange.sol";
import "./interfaces/ICvxBooster.sol";
import "./interfaces/ICvxBaseRewardPool.sol";
import "./interfaces/ICurvePool.sol";
import "./interfaces/IAlluoVault.sol";

import "hardhat/console.sol";

contract AlluoRewardsDistributor is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    IExchange public constant EXCHANGE =
        IExchange(0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec);

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address public alluoPool;
    address public rewardToken;
    EnumerableSetUpgradeable.AddressSet private vaults;

    bool public upgradeStatus;

    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _rewardToken,
        address[] memory _vaults,
        // address[] memory _pools,
        address _alluoPool,
        address _multiSigWallet
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        rewardToken = _rewardToken;
        alluoPool = _alluoPool;

        for (uint256 j; j < _vaults.length; j++) {
            vaults.add(_vaults[j]);
        }

        // for (uint256 j; j < _pools.length; j++) {
        //     pools.add(_pools[j]);
        // }

        require(_multiSigWallet.isContract(), "AlluoRewardsDist: !contract");
        _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
        _grantRole(UPGRADER_ROLE, _multiSigWallet);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    function claimAll(address exitToken)
        external
        returns (uint256 totalRewards)
    {
        uint256 totalClaimableRewards;
        uint256 length = vaults.length();
        address[] memory userVaults = new address[](length);
        uint256[] memory amounts = new uint256[](length);

        for (uint256 j; j < length; j++) {
            address vault = vaults.at(j);
            uint256 userRewards = IAlluoVault(vault).earned(msg.sender);

            userVaults[j] = vault;
            amounts[j] = userRewards;
            if (userRewards > 0) {
                // update the mapping in the vaults
                totalClaimableRewards = IAlluoVault(vault).claimRewardsDelegate(
                        msg.sender
                    );
            }
        }
        // get all rewards from the pool
        if (totalClaimableRewards == 0) return 0;

        uint256 totalRewards = IAlluoPool(alluoPool).withdrawDelegate(
            userVaults,
            amounts
        );

        console.log("totalClaimableRewards", totalClaimableRewards);
        if (exitToken != rewardToken) {
            IERC20MetadataUpgradeable(rewardToken).safeIncreaseAllowance(
                address(EXCHANGE),
                totalRewards
            );
            totalRewards = EXCHANGE.exchange(
                rewardToken,
                exitToken,
                totalRewards,
                0
            );
        }

        IERC20MetadataUpgradeable(exitToken).safeTransfer(
            msg.sender,
            totalRewards
        );
    }

    function editVault(bool add, address _vault)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (add) {
            vaults.add(_vault);
        } else {
            vaults.remove(_vault);
        }
    }

    function grantRole(bytes32 role, address account)
        public
        override
        onlyRole(getRoleAdmin(role))
    {
        if (role == DEFAULT_ADMIN_ROLE) {
            require(account.isContract(), "Not contract");
        }
        _grantRole(role, account);
    }

    function changeUpgradeStatus(bool _status)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        upgradeStatus = _status;
    }

    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {
        require(upgradeStatus, "Upgrade not allowed");
        upgradeStatus = false;
    }
}
