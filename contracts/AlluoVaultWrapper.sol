//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./interfaces/IAlluoPool.sol";
import "./interfaces/IAlluoVault.sol";
import "./interfaces/IExchange.sol";
import "./interfaces/ICurvePool.sol";

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import "hardhat/console.sol";

contract AlluoVaultWrapper is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {

    // Deposit vs Mint
    // Deposit is adding an exact amount of underlying tokens
    // Mint is creating an exact amount of shares in the vault, but potentially different number of underlying.

    // Withdraw vs Redeem:
    // Withdraw is withdrawing an exact amount of underlying tokens
    // Redeem is burning an exact amount of shares in the vault

    IExchange public constant exchange =
        IExchange(0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec);

    bytes32 public constant  UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    address public trustedForwarder;
    bool public upgradeStatus;
    address public alluoVault;
    address public lpToken;
    address public curvePool;
    EnumerableSetUpgradeable.AddressSet poolTokens;


    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;



    function initialize(
        address _multiSigWallet,
        address _trustedForwarder,
        address _lpToken,
        address _curvePool
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        lpToken = _lpToken;
        curvePool = _curvePool;
        require(_multiSigWallet.isContract(), "BaseAlluoVault: Not contract");
        _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
        _grantRole(UPGRADER_ROLE, _multiSigWallet);
        trustedForwarder = _trustedForwarder;
    }


    function deposit(uint256 assets, address entryToken) public  returns(uint256) {
        IERC20MetadataUpgradeable(entryToken).transferFrom(_msgSender(), address(this), assets);
        if (!poolTokens.contains(entryToken)) {
            IERC20MetadataUpgradeable(entryToken).safeIncreaseAllowance(address(exchange), assets);
            assets = exchange.exchange(entryToken, poolTokens.at(0), assets, 0);
            entryToken = poolTokens.at(0);

        } 
        IERC20MetadataUpgradeable(entryToken).safeIncreaseAllowance(curvePool, assets);
        if (entryToken == poolTokens.at(0)) {
            assets = ICurvePool(curvePool).add_liquidity([0, assets], 0);
        } else {
            assets = ICurvePool(curvePool).add_liquidity([assets, 0], 0);
        }
        IERC20MetadataUpgradeable(lpToken).safeIncreaseAllowance(alluoVault, assets);
        IAlluoVault(alluoVault).deposit(assets, _msgSender());
    }
 
    function mint(uint256 shares, address entryToken) public   returns (uint256) {
      
    }


    /** @dev See {IERC4626-withdraw}. */
    function withdraw(
        uint256 assets,
        address exitToken
    ) public returns (uint256) {
     
    }

    /** @dev See {IERC4626-redeem}. */
    function redeem(
        uint256 shares,
        address exitToken
    ) public returns (uint256) {
    
    }

    function claimRewards() public {
     
    }

    function isTrustedForwarder(address forwarder)
        public
        view
        virtual
        returns (bool)
    {
        return forwarder == trustedForwarder;
    }


    function setTrustedForwarder(address newTrustedForwarder)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        trustedForwarder = newTrustedForwarder;
    }

    function changeUpgradeStatus(bool _status)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        upgradeStatus = _status;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }


    function grantRole(bytes32 role, address account)
        public
        override
        onlyRole(getRoleAdmin(role))
    {
        if (role == DEFAULT_ADMIN_ROLE) {
            require(account.isContract(), "IbAlluo: Not contract");
        }
        _grantRole(role, account);
    }



        function _msgSender()
        internal
        view
        virtual
        override
        returns (address sender)
    {
        if (isTrustedForwarder(msg.sender)) {
            // The assembly code is more direct than the Solidity version using `abi.decode`.
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return super._msgSender();
        }
    }

    function _msgData()
        internal
        view
        virtual
        override
        returns (bytes calldata)
    {
        if (isTrustedForwarder(msg.sender)) {
            return msg.data[:msg.data.length - 20];
        } else {
            return super._msgData();
        }
    }
    
    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {
        require(upgradeStatus, "IbAlluo: Upgrade not allowed");
        upgradeStatus = false;
    }

    
}