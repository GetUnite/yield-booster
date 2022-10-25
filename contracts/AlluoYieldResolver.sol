// SPDX-LICENSE-IDENTIFIER: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./interfaces/IAlluoVault.sol";
import "./interfaces/IAlluoPool.sol";

interface IFastGas {
    function latestRoundData() external view returns (uint80 roundId, uint256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract AlluoYieldResolver is AccessControlUpgradeable {
    bytes32 public constant VAULT = keccak256("VAULT");
    IFastGas constant chainlinkFastGas = IFastGas(0x169E633A2D1E6c10dD91238Ba11c4A708dfEF37C);

    EnumerableSetUpgradeable.AddressSet vaults;
    EnumerableSetUpgradeable.AddressSet boostPools;
    mapping(address => uint256) vaultLastStake;
    mapping(address => uint256) boostLastFarm;

    uint256 public stakeTime;
    uint256 public farmTime;
    uint256 public maxGas;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    constructor(uint256 _maxGas, uint256 _stakeTime, uint256 _farmTime, address[] memory _vaults, address[] memory _boostPools)  {
        maxGas = _maxGas;
        stakeTime = _stakeTime;
        farmTime = _farmTime;
        for (uint256 i; i < _vaults.length; i++) {
            vaults.add(_vaults[i]);
        }
        for (uint256 i; i < _boostPools.length; i++) {
            boostPools.add(_boostPools[i]);
        }
    }

    function currentGasPriceAcceptable() public view returns (bool acceptable) {
        (,uint256 gas,,,) = chainlinkFastGas.latestRoundData();
        acceptable = true ? gas < maxGas : false;
    }

    function stakingChecker() external view  returns (bool canExec, bytes memory execPayload) {
        for (uint256 i; i < vaults.length(); i++) {
            address vault = vaults.at(i);
            address asset = IAlluoVault(vaults.at(i)).asset();
            if (IERC20Upgradeable(asset).balanceOf(vault) > 0 && block.timestamp > vaultLastStake[vault] + stakeTime && currentGasPriceAcceptable() ) {
                return(true, abi.encodeWithSelector(AlluoYieldResolver.stakeFunds.selector, i));
            }
        }
        return (canExec, execPayload);
    }

    function stakeFunds(uint256 index) external {
        IAlluoVault(vaults.at(index)).stakeUnderlying();
    }

    function farmFunds(uint256 index) external {
        IAlluoPool(boostPools.at(index)).farm();
    }

    function farmingChecker() external view  returns (bool canExec, bytes memory execPayload) {
        for (uint256 i; i < boostPools.length(); i++) {
            address boostPool = boostPools.at(i);
            if (block.timestamp > boostLastFarm[boostPool] + farmTime && currentGasPriceAcceptable() ) {
                return(true, abi.encodeWithSelector(AlluoYieldResolver.farmFunds.selector, i));
            }
        }
        return (canExec, execPayload);
    }


    function setStakeTime(uint256 newTime) external {
        stakeTime = newTime;
    }

    function setFarmTime(uint256 newTime) external {
        farmTime = newTime;
    }

    function setMaxGas(uint256 newMaxGas) external {
        maxGas = newMaxGas;
    }


    function editVaults (bool add, address _vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (add) {
            vaults.add(_vault);
        } else {
            vaults.remove(_vault);
        }
    }

       function editboostPools (bool add, address _boostPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (add) {
            boostPools.add(_boostPool);
        } else {
            boostPools.remove(_boostPool);
        }
    }
}