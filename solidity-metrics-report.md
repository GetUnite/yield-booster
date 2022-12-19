
[<img width="200" alt="get in touch with Consensys Diligence" src="https://user-images.githubusercontent.com/2865694/56826101-91dcf380-685b-11e9-937c-af49c2510aa0.png">](https://diligence.consensys.net)<br/>
<sup>
[[  🌐  ](https://diligence.consensys.net)  [  📩  ](mailto:diligence@consensys.net)  [  🔥  ](https://consensys.github.io/diligence/)]
</sup><br/><br/>



# Solidity Metrics for GetAlluo/yield-booster

## Table of contents

- [Scope](#t-scope)
    - [Source Units in Scope](#t-source-Units-in-Scope)
    - [Out of Scope](#t-out-of-scope)
        - [Excluded Source Units](#t-out-of-scope-excluded-source-units)
        - [Duplicate Source Units](#t-out-of-scope-duplicate-source-units)
        - [Doppelganger Contracts](#t-out-of-scope-doppelganger-contracts)
- [Report Overview](#t-report)
    - [Risk Summary](#t-risk)
    - [Source Lines](#t-source-lines)
    - [Inline Documentation](#t-inline-documentation)
    - [Components](#t-components)
    - [Exposed Functions](#t-exposed-functions)
    - [StateVariables](#t-statevariables)
    - [Capabilities](#t-capabilities)
    - [Dependencies](#t-package-imports)
    - [Totals](#t-totals)

## <span id=t-scope>Scope</span>

This section lists files that are in scope for the metrics report. 

- **Project:** `GetAlluo/yield-booster`
- **Included Files:** 
    - ``
- **Excluded Paths:** 
    - ``
- **File Limit:** `undefined`
    - **Exclude File list Limit:** `undefined`

- **Workspace Repository:** `unknown` (`undefined`@`undefined`)

### <span id=t-source-Units-in-Scope>Source Units in Scope</span>

Source Units Analyzed: **`14`**<br>
Source Units in Scope: **`14`** (**100%**)

| Type | File   | Logic Contracts | Interfaces | Lines | nLines | nSLOC | Comment Lines | Complex. Score | Capabilities |
|========|=================|============|=======|=======|===============|==============|  
| 📝 | contracts\AlluoVaultPool.sol | 1 | **** | 271 | 252 | 185 | 24 | 235 | **<abbr title='Uses Hash-Functions'>🧮</abbr>** |
| 📝 | contracts\AlluoVaultUpgradeable.sol | 1 | **** | 484 | 427 | 306 | 64 | 370 | **<abbr title='Uses Assembly'>🖥</abbr><abbr title='Uses Hash-Functions'>🧮</abbr>** |
| 📝🔍 | contracts\AlluoYieldResolver.sol | 1 | 1 | 168 | 133 | 112 | 2 | 99 | **<abbr title='Uses Hash-Functions'>🧮</abbr>** |
| 🔍 | contracts\interfaces\IAlluoPool.sol | **** | 1 | 20 | 12 | 7 | 1 | 17 | **** |
| 🔍 | contracts\interfaces\IAlluoVault.sol | **** | 1 | 209 | 46 | 43 | 1 | 126 | **<abbr title='Payable Functions'>💰</abbr>** |
| 🔍 | contracts\interfaces\ICurvePool.sol | **** | 1 | 8 | 5 | 3 | 1 | 10 | **<abbr title='Payable Functions'>💰</abbr>** |
| 🔍 | contracts\interfaces\ICvxBaseRewardPool.sol | **** | 1 | 80 | 5 | 3 | 1 | 73 | **** |
| 🔍 | contracts\interfaces\ICvxBooster.sol | **** | 1 | 164 | 11 | 3 | 5 | 113 | **** |
| 🔍 | contracts\interfaces\IExchange.sol | **** | 1 | 23 | 12 | 9 | 5 | 8 | **<abbr title='Payable Functions'>💰</abbr>** |
| 🔍 | contracts\interfaces\IWrappedEther.sol | **** | 1 | 30 | 5 | 3 | 1 | 26 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝🔍 | contracts\mock\CurveCvxEthAdapter.sol | 1 | 2 | 104 | 48 | 36 | 11 | 68 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝🔍 | contracts\mock\CurveFraxUsdcAdapter.sol | 1 | 2 | 104 | 50 | 36 | 11 | 62 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝🔍 | contracts\mock\CurveStEthAdapter.sol | 1 | 3 | 136 | 55 | 44 | 11 | 100 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝🔍 | contracts\mock\Exchange.sol | 1 | 2 | 715 | 571 | 358 | 122 | 381 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝🔍 | **Totals** | **7** | **17** | **2516**  | **1632** | **1148** | **260** | **1688** | **<abbr title='Uses Assembly'>🖥</abbr><abbr title='Payable Functions'>💰</abbr><abbr title='Uses Hash-Functions'>🧮</abbr>** |

<sub>
Legend: <a onclick="toggleVisibility('table-legend', this)">[➕]</a>
<div id="table-legend" style="display:none">

<ul>
<li> <b>Lines</b>: total lines of the source unit </li>
<li> <b>nLines</b>: normalized lines of the source unit (e.g. normalizes functions spanning multiple lines) </li>
<li> <b>nSLOC</b>: normalized source lines of code (only source-code lines; no comments, no blank lines) </li>
<li> <b>Comment Lines</b>: lines containing single or block comments </li>
<li> <b>Complexity Score</b>: a custom complexity score derived from code statements that are known to introduce code complexity (branches, loops, calls, external interfaces, ...) </li>
</ul>

</div>
</sub>


#### <span id=t-out-of-scope>Out of Scope</span>

##### <span id=t-out-of-scope-excluded-source-units>Excluded Source Units</span>

Source Units Excluded: **`0`**

<a onclick="toggleVisibility('excluded-files', this)">[➕]</a>
<div id="excluded-files" style="display:none">
| File   |
|========|
| None |

</div>


##### <span id=t-out-of-scope-duplicate-source-units>Duplicate Source Units</span>

Duplicate Source Units Excluded: **`0`** 

<a onclick="toggleVisibility('duplicate-files', this)">[➕]</a>
<div id="duplicate-files" style="display:none">
| File   |
|========|
| None |

</div>

##### <span id=t-out-of-scope-doppelganger-contracts>Doppelganger Contracts</span>

Doppelganger Contracts: **`0`** 

<a onclick="toggleVisibility('doppelganger-contracts', this)">[➕]</a>
<div id="doppelganger-contracts" style="display:none">
| File   | Contract | Doppelganger | 
|========|==========|==============|


</div>


## <span id=t-report>Report</span>

### Overview

The analysis finished with **`0`** errors and **`0`** duplicate files.





#### <span id=t-risk>Risk</span>

<div class="wrapper" style="max-width: 512px; margin: auto">
			<canvas id="chart-risk-summary"></canvas>
</div>

#### <span id=t-source-lines>Source Lines (sloc vs. nsloc)</span>

<div class="wrapper" style="max-width: 512px; margin: auto">
    <canvas id="chart-nsloc-total"></canvas>
</div>

#### <span id=t-inline-documentation>Inline Documentation</span>

- **Comment-to-Source Ratio:** On average there are`6.95` code lines per comment (lower=better).
- **ToDo's:** `0` 

#### <span id=t-components>Components</span>

| 📝Contracts   | 📚Libraries | 🔍Interfaces | 🎨Abstract |
|=============|===========|============|============|
| 7 | 0  | 17  | 0 |

#### <span id=t-exposed-functions>Exposed Functions</span>

This section lists functions that are explicitly declared public or payable. Please note that getter methods for public stateVars are not included.  

| 🌐Public   | 💰Payable |
|============|===========|
| 300 | 33  | 

| External   | Internal | Private | Pure | View |
|============|==========|=========|======|======|
| 272 | 159  | 4 | 4 | 136 |

#### <span id=t-statevariables>StateVariables</span>

| Total      | 🌐Public  |
|============|===========|
| 56  | 42 |

#### <span id=t-capabilities>Capabilities</span>

| Solidity Versions observed | 🧪 Experimental Features | 💰 Can Receive Funds | 🖥 Uses Assembly | 💣 Has Destroyable Contracts | 
|============|===========|===========|===========|
| `^0.8.11`<br/>`0.8.11` |  | `yes` | `yes` <br/>(1 asm blocks) | **** | 

| 📤 Transfers ETH | ⚡ Low-Level Calls | 👥 DelegateCall | 🧮 Uses Hash Functions | 🔖 ECRecover | 🌀 New/Create/Create2 |
|============|===========|===========|===========|===========|
| **** | **** | **** | `yes` | **** | **** | 

| ♻️ TryCatch | Σ Unchecked |
|============|===========|
| **** | **** |

#### <span id=t-package-imports>Dependencies / External Imports</span>

| Dependency / Import Path | Count  | 
|==========================|========|
| @openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol | 3 |
| @openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol | 2 |
| @openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol | 2 |
| @openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol | 2 |
| @openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol | 1 |
| @openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol | 1 |
| @openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol | 1 |
| @openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol | 1 |
| @openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol | 3 |
| @openzeppelin/contracts/access/AccessControl.sol | 1 |
| @openzeppelin/contracts/interfaces/IERC20.sol | 4 |
| @openzeppelin/contracts/security/ReentrancyGuard.sol | 1 |
| @openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol | 1 |
| @openzeppelin/contracts/utils/Address.sol | 1 |
| hardhat/console.sol | 1 |

#### <span id=t-totals>Totals</span>

##### Summary

<div class="wrapper" style="max-width: 90%; margin: auto">
    <canvas id="chart-num-bar"></canvas>
</div>

##### AST Node Statistics

###### Function Calls

<div class="wrapper" style="max-width: 90%; margin: auto">
    <canvas id="chart-num-bar-ast-funccalls"></canvas>
</div>

###### Assembly Calls

<div class="wrapper" style="max-width: 90%; margin: auto">
    <canvas id="chart-num-bar-ast-asmcalls"></canvas>
</div>

###### AST Total

<div class="wrapper" style="max-width: 90%; margin: auto">
    <canvas id="chart-num-bar-ast"></canvas>
</div>

##### Inheritance Graph

<a onclick="toggleVisibility('surya-inherit', this)">[➕]</a>
<div id="surya-inherit" style="display:none">
<div class="wrapper" style="max-width: 512px; margin: auto">
    <div id="surya-inheritance" style="text-align: center;"></div> 
</div>
</div>

##### CallGraph

<a onclick="toggleVisibility('surya-call', this)">[➕]</a>
<div id="surya-call" style="display:none">
<div class="wrapper" style="max-width: 512px; margin: auto">
    <div id="surya-callgraph" style="text-align: center;"></div>
</div>
</div>

###### Contract Summary

<a onclick="toggleVisibility('surya-mdreport', this)">[➕]</a>
<div id="surya-mdreport" style="display:none">
 Sūrya's Description Report

 Files Description Table


|  File Name  |  SHA-1 Hash  |
|-------------|--------------|
| contracts\AlluoVaultPool.sol | 025cc96aafe5f426e85785303371b1ccb78ad168 |
| contracts\AlluoVaultUpgradeable.sol | 490014e6f202327db42ecd4a27e639dbdbfd9d5e |
| contracts\AlluoYieldResolver.sol | 494feb73c7bb76e815b818b627f4adb638d525f4 |
| contracts\interfaces\IAlluoPool.sol | 1c2cd6384e6b02671d027126b5882d73f2d347b0 |
| contracts\interfaces\IAlluoVault.sol | eb096f56a307f63d57a274089e2f294cb8df372a |
| contracts\interfaces\ICurvePool.sol | 26821d8dfe92251a6a356765b25cab9b8faeeda2 |
| contracts\interfaces\ICvxBaseRewardPool.sol | a814fd62b55c18b627840f63b6fe859a65a32445 |
| contracts\interfaces\ICvxBooster.sol | f3fdb4f9bda359658f9faa1644a99d2fafd417cc |
| contracts\interfaces\IExchange.sol | 59711498abe64b38f79e12d77e11b30e5d693c2d |
| contracts\interfaces\IWrappedEther.sol | 4d3645129fd1d5e0b921935fb77c1b0f92f86982 |
| contracts\mock\CurveCvxEthAdapter.sol | 11dd4835ce9a8d0505b7c859f48b71dbbf674f4c |
| contracts\mock\CurveFraxUsdcAdapter.sol | 52855424220d79baf7416ae31098050c2e65db33 |
| contracts\mock\CurveStEthAdapter.sol | 514403438ed4a69aaac79c96e390bacd8da2d81c |
| contracts\mock\Exchange.sol | ebaab1aa217db94f7f16ca55455ea9da0ffd45d2 |


 Contracts Description Table


|  Contract  |         Type        |       Bases      |                  |                 |
|:----------:|:-------------------:|:----------------:|:----------------:|:---------------:|
|     └      |  **Function Name**  |  **Visibility**  |  **Mutability**  |  **Modifiers**  |
||||||
| **AlluoVaultPool** | Implementation | Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable |||
| └ | <Constructor> | Public ❗️ | 🛑  | initializer |
| └ | initialize | Public ❗️ | 🛑  | initializer |
| └ | farm | External ❗️ | 🛑  | onlyRole |
| └ | _convertToSharesAfterPoolRewards | Internal 🔒 |   | |
| └ | _convertToShares | Internal 🔒 |   | |
| └ | _convertToAssets | Internal 🔒 |   | |
| └ | rewardTokenBalance | External ❗️ |   |NO❗️ |
| └ | depositIntoBooster | External ❗️ | 🛑  |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  | onlyRole |
| └ | accruedRewards | Public ❗️ |   |NO❗️ |
| └ | fundsLocked | Public ❗️ |   |NO❗️ |
| └ | claimRewardsFromPool | Public ❗️ | 🛑  |NO❗️ |
| └ | editVault | External ❗️ | 🛑  | onlyRole |
| └ | editYieldTokens | External ❗️ | 🛑  | onlyRole |
| └ | changeEntryToken | External ❗️ | 🛑  | onlyRole |
| └ | changeUpgradeStatus | External ❗️ | 🛑  | onlyRole |
| └ | pause | External ❗️ | 🛑  | onlyRole |
| └ | unpause | External ❗️ | 🛑  | onlyRole |
| └ | grantRole | Public ❗️ | 🛑  | onlyRole |
| └ | _authorizeUpgrade | Internal 🔒 | 🛑  | onlyRole |
||||||
| **AlluoVaultUpgradeable** | Implementation | Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable, ERC4626Upgradeable |||
| └ | <Constructor> | Public ❗️ | 🛑  | initializer |
| └ | initialize | Public ❗️ | 🛑  | initializer |
| └ | loopRewards | External ❗️ | 🛑  | onlyRole |
| └ | claimAndConvertToPoolEntryToken | External ❗️ | 🛑  | onlyRole |
| └ | accruedRewards | Public ❗️ |   |NO❗️ |
| └ | shareholderAccruedRewards | Public ❗️ |   |NO❗️ |
| └ | stakeUnderlying | External ❗️ | 🛑  |NO❗️ |
| └ | claimRewardsFromPool | Public ❗️ | 🛑  |NO❗️ |
| └ | _distributeReward | Internal 🔒 | 🛑  | |
| └ | earned | Public ❗️ |   |NO❗️ |
| └ | deposit | Public ❗️ | 🛑  |NO❗️ |
| └ | depositWithoutLP | Public ❗️ | 🛑  |NO❗️ |
| └ | _nonLpMaxDeposit | Internal 🔒 |   | |
| └ | _nonLpPreviewDeposit | Internal 🔒 |   | |
| └ | mint | Public ❗️ | 🛑  |NO❗️ |
| └ | withdraw | Public ❗️ | 🛑  |NO❗️ |
| └ | withdrawToNonLp | Public ❗️ | 🛑  |NO❗️ |
| └ | redeem | Public ❗️ | 🛑  |NO❗️ |
| └ | claimRewards | Public ❗️ | 🛑  |NO❗️ |
| └ | claimRewardsInNonLp | Public ❗️ | 🛑  |NO❗️ |
| └ | _unstakeForWithdraw | Internal 🔒 | 🛑  | |
| └ | totalAssets | Public ❗️ |   |NO❗️ |
| └ | stakedBalanceOf | Public ❗️ |   |NO❗️ |
| └ | _beforeTokenTransfer | Internal 🔒 | 🛑  | |
| └ | setPool | External ❗️ | 🛑  | onlyRole |
| └ | addPoolTokens | External ❗️ | 🛑  | onlyRole |
| └ | isTrustedForwarder | Public ❗️ |   |NO❗️ |
| └ | setTrustedForwarder | External ❗️ | 🛑  | onlyRole |
| └ | changeUpgradeStatus | External ❗️ | 🛑  | onlyRole |
| └ | pause | External ❗️ | 🛑  | onlyRole |
| └ | unpause | External ❗️ | 🛑  | onlyRole |
| └ | setAdminFee | External ❗️ | 🛑  | onlyRole |
| └ | grantRole | Public ❗️ | 🛑  | onlyRole |
| └ | _msgSender | Internal 🔒 |   | |
| └ | _msgData | Internal 🔒 |   | |
| └ | _authorizeUpgrade | Internal 🔒 | 🛑  | onlyRole |
||||||
| **IFastGas** | Interface |  |||
| └ | latestRoundData | External ❗️ |   |NO❗️ |
||||||
| **AlluoYieldResolver** | Implementation | AccessControlUpgradeable |||
| └ | <Constructor> | Public ❗️ | 🛑  |NO❗️ |
| └ | currentGasPriceAcceptable | Public ❗️ |   |NO❗️ |
| └ | stakingChecker | External ❗️ |   |NO❗️ |
| └ | farmingChecker | External ❗️ |   |NO❗️ |
| └ | stakeFunds | External ❗️ | 🛑  | onlyRole |
| └ | farmFunds | External ❗️ | 🛑  | onlyRole |
| └ | setStakeTime | External ❗️ | 🛑  | onlyRole |
| └ | setFarmTime | External ❗️ | 🛑  | onlyRole |
| └ | setMaxGas | External ❗️ | 🛑  | onlyRole |
| └ | editVaults | External ❗️ | 🛑  | onlyRole |
| └ | editboostPools | External ❗️ | 🛑  | onlyRole |
||||||
| **IAlluoPool** | Interface |  |||
| └ | farm | External ❗️ | 🛑  |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  |NO❗️ |
| └ | fundsLocked | External ❗️ |   |NO❗️ |
| └ | claimRewardsFromPool | External ❗️ | 🛑  |NO❗️ |
| └ | rewardTokenBalance | External ❗️ |   |NO❗️ |
| └ | accruedRewards | External ❗️ |   |NO❗️ |
| └ | balances | External ❗️ |   |NO❗️ |
| └ | totalBalances | External ❗️ |   |NO❗️ |
||||||
| **IAlluoVault** | Interface |  |||
| └ | DEFAULT_ADMIN_ROLE | External ❗️ |   |NO❗️ |
| └ | UPGRADER_ROLE | External ❗️ |   |NO❗️ |
| └ | allowance | External ❗️ |   |NO❗️ |
| └ | alluoPool | External ❗️ |   |NO❗️ |
| └ | approve | External ❗️ | 🛑  |NO❗️ |
| └ | asset | External ❗️ |   |NO❗️ |
| └ | balanceOf | External ❗️ |   |NO❗️ |
| └ | changeUpgradeStatus | External ❗️ | 🛑  |NO❗️ |
| └ | claimRewards | External ❗️ | 🛑  |NO❗️ |
| └ | claimRewardsFromPool | External ❗️ | 🛑  |NO❗️ |
| └ | convertToAssets | External ❗️ |   |NO❗️ |
| └ | convertToShares | External ❗️ |   |NO❗️ |
| └ | cvxBooster | External ❗️ |   |NO❗️ |
| └ | decimals | External ❗️ |   |NO❗️ |
| └ | decreaseAllowance | External ❗️ | 🛑  |NO❗️ |
| └ | deposit | External ❗️ | 🛑  |NO❗️ |
| └ | earned | External ❗️ |   |NO❗️ |
| └ | getRoleAdmin | External ❗️ |   |NO❗️ |
| └ | grantRole | External ❗️ | 🛑  |NO❗️ |
| └ | hasRole | External ❗️ |   |NO❗️ |
| └ | increaseAllowance | External ❗️ | 🛑  |NO❗️ |
| └ | initialize | External ❗️ | 🛑  |NO❗️ |
| └ | isTrustedForwarder | External ❗️ |   |NO❗️ |
| └ | loopRewards | External ❗️ | 🛑  |NO❗️ |
| └ | maxDeposit | External ❗️ |   |NO❗️ |
| └ | maxMint | External ❗️ |   |NO❗️ |
| └ | maxRedeem | External ❗️ |   |NO❗️ |
| └ | maxWithdraw | External ❗️ |   |NO❗️ |
| └ | mint | External ❗️ | 🛑  |NO❗️ |
| └ | name | External ❗️ |   |NO❗️ |
| └ | pause | External ❗️ | 🛑  |NO❗️ |
| └ | paused | External ❗️ |   |NO❗️ |
| └ | poolId | External ❗️ |   |NO❗️ |
| └ | previewDeposit | External ❗️ |   |NO❗️ |
| └ | previewMint | External ❗️ |   |NO❗️ |
| └ | previewRedeem | External ❗️ |   |NO❗️ |
| └ | previewWithdraw | External ❗️ |   |NO❗️ |
| └ | proxiableUUID | External ❗️ |   |NO❗️ |
| └ | redeem | External ❗️ | 🛑  |NO❗️ |
| └ | renounceRole | External ❗️ | 🛑  |NO❗️ |
| └ | revokeRole | External ❗️ | 🛑  |NO❗️ |
| └ | rewards | External ❗️ |   |NO❗️ |
| └ | rewardsPerShareAccumulated | External ❗️ |   |NO❗️ |
| └ | setPool | External ❗️ | 🛑  |NO❗️ |
| └ | setTrustedForwarder | External ❗️ | 🛑  |NO❗️ |
| └ | stakeUnderlying | External ❗️ | 🛑  |NO❗️ |
| └ | stakedBalanceOf | External ❗️ |   |NO❗️ |
| └ | supportsInterface | External ❗️ |   |NO❗️ |
| └ | symbol | External ❗️ |   |NO❗️ |
| └ | totalAssets | External ❗️ |   |NO❗️ |
| └ | totalSupply | External ❗️ |   |NO❗️ |
| └ | transfer | External ❗️ | 🛑  |NO❗️ |
| └ | transferFrom | External ❗️ | 🛑  |NO❗️ |
| └ | trustedForwarder | External ❗️ |   |NO❗️ |
| └ | unpause | External ❗️ | 🛑  |NO❗️ |
| └ | upgradeStatus | External ❗️ |   |NO❗️ |
| └ | upgradeTo | External ❗️ | 🛑  |NO❗️ |
| └ | upgradeToAndCall | External ❗️ |  💵 |NO❗️ |
| └ | userRewardPaid | External ❗️ |   |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  |NO❗️ |
| └ | claimAndConvertToPoolEntryToken | External ❗️ | 🛑  |NO❗️ |
||||||
| **ICurvePool** | Interface |  |||
| └ | add_liquidity | External ❗️ |  💵 |NO❗️ |
| └ | token | External ❗️ | 🛑  |NO❗️ |
| └ | remove_liquidity_one_coin | External ❗️ | 🛑  |NO❗️ |
||||||
| **ICvxBaseRewardPool** | Interface |  |||
| └ | addExtraReward | External ❗️ | 🛑  |NO❗️ |
| └ | balanceOf | External ❗️ |   |NO❗️ |
| └ | clearExtraRewards | External ❗️ | 🛑  |NO❗️ |
| └ | currentRewards | External ❗️ |   |NO❗️ |
| └ | donate | External ❗️ | 🛑  |NO❗️ |
| └ | duration | External ❗️ |   |NO❗️ |
| └ | earned | External ❗️ |   |NO❗️ |
| └ | extraRewards | External ❗️ |   |NO❗️ |
| └ | extraRewardsLength | External ❗️ |   |NO❗️ |
| └ | getReward | External ❗️ | 🛑  |NO❗️ |
| └ | getReward | External ❗️ | 🛑  |NO❗️ |
| └ | historicalRewards | External ❗️ |   |NO❗️ |
| └ | lastTimeRewardApplicable | External ❗️ |   |NO❗️ |
| └ | lastUpdateTime | External ❗️ |   |NO❗️ |
| └ | newRewardRatio | External ❗️ |   |NO❗️ |
| └ | operator | External ❗️ |   |NO❗️ |
| └ | periodFinish | External ❗️ |   |NO❗️ |
| └ | pid | External ❗️ |   |NO❗️ |
| └ | queueNewRewards | External ❗️ | 🛑  |NO❗️ |
| └ | queuedRewards | External ❗️ |   |NO❗️ |
| └ | rewardManager | External ❗️ |   |NO❗️ |
| └ | rewardPerToken | External ❗️ |   |NO❗️ |
| └ | rewardPerTokenStored | External ❗️ |   |NO❗️ |
| └ | rewardRate | External ❗️ |   |NO❗️ |
| └ | rewardToken | External ❗️ |   |NO❗️ |
| └ | rewards | External ❗️ |   |NO❗️ |
| └ | stake | External ❗️ | 🛑  |NO❗️ |
| └ | stakeAll | External ❗️ | 🛑  |NO❗️ |
| └ | stakeFor | External ❗️ | 🛑  |NO❗️ |
| └ | stakingToken | External ❗️ |   |NO❗️ |
| └ | totalSupply | External ❗️ |   |NO❗️ |
| └ | userRewardPerTokenPaid | External ❗️ |   |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  |NO❗️ |
| └ | withdrawAll | External ❗️ | 🛑  |NO❗️ |
| └ | withdrawAllAndUnwrap | External ❗️ | 🛑  |NO❗️ |
| └ | withdrawAndUnwrap | External ❗️ | 🛑  |NO❗️ |
||||||
| **ICvxBooster** | Interface |  |||
| └ | FEE_DENOMINATOR | External ❗️ |   |NO❗️ |
| └ | MaxFees | External ❗️ |   |NO❗️ |
| └ | addPool | External ❗️ | 🛑  |NO❗️ |
| └ | claimRewards | External ❗️ | 🛑  |NO❗️ |
| └ | crv | External ❗️ |   |NO❗️ |
| └ | deposit | External ❗️ | 🛑  |NO❗️ |
| └ | depositAll | External ❗️ | 🛑  |NO❗️ |
| └ | distributionAddressId | External ❗️ |   |NO❗️ |
| └ | earmarkFees | External ❗️ | 🛑  |NO❗️ |
| └ | earmarkIncentive | External ❗️ |   |NO❗️ |
| └ | earmarkRewards | External ❗️ | 🛑  |NO❗️ |
| └ | feeDistro | External ❗️ |   |NO❗️ |
| └ | feeManager | External ❗️ |   |NO❗️ |
| └ | feeToken | External ❗️ |   |NO❗️ |
| └ | gaugeMap | External ❗️ |   |NO❗️ |
| └ | isShutdown | External ❗️ |   |NO❗️ |
| └ | lockFees | External ❗️ |   |NO❗️ |
| └ | lockIncentive | External ❗️ |   |NO❗️ |
| └ | lockRewards | External ❗️ |   |NO❗️ |
| └ | minter | External ❗️ |   |NO❗️ |
| └ | owner | External ❗️ |   |NO❗️ |
| └ | platformFee | External ❗️ |   |NO❗️ |
| └ | poolInfo | External ❗️ |   |NO❗️ |
| └ | poolLength | External ❗️ |   |NO❗️ |
| └ | poolManager | External ❗️ |   |NO❗️ |
| └ | registry | External ❗️ |   |NO❗️ |
| └ | rewardArbitrator | External ❗️ |   |NO❗️ |
| └ | rewardClaimed | External ❗️ | 🛑  |NO❗️ |
| └ | rewardFactory | External ❗️ |   |NO❗️ |
| └ | setArbitrator | External ❗️ | 🛑  |NO❗️ |
| └ | setFactories | External ❗️ | 🛑  |NO❗️ |
| └ | setFeeInfo | External ❗️ | 🛑  |NO❗️ |
| └ | setFeeManager | External ❗️ | 🛑  |NO❗️ |
| └ | setFees | External ❗️ | 🛑  |NO❗️ |
| └ | setGaugeRedirect | External ❗️ | 🛑  |NO❗️ |
| └ | setOwner | External ❗️ | 🛑  |NO❗️ |
| └ | setPoolManager | External ❗️ | 🛑  |NO❗️ |
| └ | setRewardContracts | External ❗️ | 🛑  |NO❗️ |
| └ | setTreasury | External ❗️ | 🛑  |NO❗️ |
| └ | setVoteDelegate | External ❗️ | 🛑  |NO❗️ |
| └ | shutdownPool | External ❗️ | 🛑  |NO❗️ |
| └ | shutdownSystem | External ❗️ | 🛑  |NO❗️ |
| └ | staker | External ❗️ |   |NO❗️ |
| └ | stakerIncentive | External ❗️ |   |NO❗️ |
| └ | stakerRewards | External ❗️ |   |NO❗️ |
| └ | stashFactory | External ❗️ |   |NO❗️ |
| └ | tokenFactory | External ❗️ |   |NO❗️ |
| └ | treasury | External ❗️ |   |NO❗️ |
| └ | vote | External ❗️ | 🛑  |NO❗️ |
| └ | voteDelegate | External ❗️ |   |NO❗️ |
| └ | voteGaugeWeight | External ❗️ | 🛑  |NO❗️ |
| └ | voteOwnership | External ❗️ |   |NO❗️ |
| └ | voteParameter | External ❗️ |   |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  |NO❗️ |
| └ | withdrawAll | External ❗️ | 🛑  |NO❗️ |
| └ | withdrawTo | External ❗️ | 🛑  |NO❗️ |
||||||
| **IExchange** | Interface |  |||
| └ | exchange | External ❗️ |  💵 |NO❗️ |
| └ | buildRoute | External ❗️ |   |NO❗️ |
||||||
| **IWrappedEther** | Interface |  |||
| └ | name | External ❗️ |   |NO❗️ |
| └ | approve | External ❗️ | 🛑  |NO❗️ |
| └ | totalSupply | External ❗️ |   |NO❗️ |
| └ | transferFrom | External ❗️ | 🛑  |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  |NO❗️ |
| └ | decimals | External ❗️ |   |NO❗️ |
| └ | balanceOf | External ❗️ |   |NO❗️ |
| └ | symbol | External ❗️ |   |NO❗️ |
| └ | transfer | External ❗️ | 🛑  |NO❗️ |
| └ | deposit | External ❗️ |  💵 |NO❗️ |
| └ | allowance | External ❗️ |   |NO❗️ |
||||||
| **IExchangeAdapter** | Interface |  |||
| └ | executeSwap | External ❗️ |  💵 |NO❗️ |
| └ | enterPool | External ❗️ |  💵 |NO❗️ |
| └ | exitPool | External ❗️ |  💵 |NO❗️ |
||||||
| **ICurveCvxEth** | Interface |  |||
| └ | exchange | External ❗️ |  💵 |NO❗️ |
| └ | add_liquidity | External ❗️ |  💵 |NO❗️ |
| └ | remove_liquidity_one_coin | External ❗️ | 🛑  |NO❗️ |
||||||
| **CurveCvxEthAdapter** | Implementation | IExchangeAdapter |||
| └ | indexByCoin | Public ❗️ |   |NO❗️ |
| └ | executeSwap | External ❗️ |  💵 |NO❗️ |
| └ | enterPool | External ❗️ |  💵 |NO❗️ |
| └ | exitPool | External ❗️ |  💵 |NO❗️ |
||||||
| **IExchangeAdapter** | Interface |  |||
| └ | executeSwap | External ❗️ |  💵 |NO❗️ |
| └ | enterPool | External ❗️ |  💵 |NO❗️ |
| └ | exitPool | External ❗️ |  💵 |NO❗️ |
||||||
| **ICurveFrax** | Interface |  |||
| └ | exchange | External ❗️ | 🛑  |NO❗️ |
| └ | add_liquidity | External ❗️ | 🛑  |NO❗️ |
| └ | remove_liquidity_one_coin | External ❗️ | 🛑  |NO❗️ |
||||||
| **CurveFraxUsdcAdapter** | Implementation | IExchangeAdapter |||
| └ | indexByCoin | Public ❗️ |   |NO❗️ |
| └ | executeSwap | External ❗️ |  💵 |NO❗️ |
| └ | enterPool | External ❗️ |  💵 |NO❗️ |
| └ | exitPool | External ❗️ |  💵 |NO❗️ |
||||||
| **IWrappedEther** | Interface |  |||
| └ | name | External ❗️ |   |NO❗️ |
| └ | approve | External ❗️ | 🛑  |NO❗️ |
| └ | totalSupply | External ❗️ |   |NO❗️ |
| └ | transferFrom | External ❗️ | 🛑  |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  |NO❗️ |
| └ | decimals | External ❗️ |   |NO❗️ |
| └ | balanceOf | External ❗️ |   |NO❗️ |
| └ | symbol | External ❗️ |   |NO❗️ |
| └ | transfer | External ❗️ | 🛑  |NO❗️ |
| └ | deposit | External ❗️ |  💵 |NO❗️ |
| └ | allowance | External ❗️ |   |NO❗️ |
||||||
| **IExchangeAdapter** | Interface |  |||
| └ | executeSwap | External ❗️ |  💵 |NO❗️ |
| └ | enterPool | External ❗️ |  💵 |NO❗️ |
| └ | exitPool | External ❗️ |  💵 |NO❗️ |
||||||
| **ICurveStEth** | Interface |  |||
| └ | exchange | External ❗️ |  💵 |NO❗️ |
| └ | add_liquidity | External ❗️ |  💵 |NO❗️ |
| └ | remove_liquidity_one_coin | External ❗️ | 🛑  |NO❗️ |
||||||
| **CurveStEthAdapter** | Implementation | IExchangeAdapter |||
| └ | indexByCoin | Public ❗️ |   |NO❗️ |
| └ | executeSwap | External ❗️ |  💵 |NO❗️ |
| └ | enterPool | External ❗️ |  💵 |NO❗️ |
| └ | exitPool | External ❗️ |  💵 |NO❗️ |
||||||
| **IWrappedEther** | Interface |  |||
| └ | name | External ❗️ |   |NO❗️ |
| └ | approve | External ❗️ | 🛑  |NO❗️ |
| └ | totalSupply | External ❗️ |   |NO❗️ |
| └ | transferFrom | External ❗️ | 🛑  |NO❗️ |
| └ | withdraw | External ❗️ | 🛑  |NO❗️ |
| └ | decimals | External ❗️ |   |NO❗️ |
| └ | balanceOf | External ❗️ |   |NO❗️ |
| └ | symbol | External ❗️ |   |NO❗️ |
| └ | transfer | External ❗️ | 🛑  |NO❗️ |
| └ | deposit | External ❗️ |  💵 |NO❗️ |
| └ | allowance | External ❗️ |   |NO❗️ |
||||||
| **IExchangeAdapter** | Interface |  |||
| └ | executeSwap | External ❗️ |  💵 |NO❗️ |
| └ | enterPool | External ❗️ |  💵 |NO❗️ |
| └ | exitPool | External ❗️ |  💵 |NO❗️ |
||||||
| **Exchange** | Implementation | ReentrancyGuard, AccessControl |||
| └ | <Constructor> | Public ❗️ | 🛑  |NO❗️ |
| └ | exchange | External ❗️ |  💵 | nonReentrant |
| └ | registerAdapters | External ❗️ | 🛑  | onlyRole |
| └ | unregisterAdapters | External ❗️ | 🛑  | onlyRole |
| └ | createMinorCoinEdge | External ❗️ | 🛑  | onlyRole |
| └ | deleteMinorCoinEdge | External ❗️ | 🛑  | onlyRole |
| └ | createInternalMajorRoutes | External ❗️ | 🛑  | onlyRole |
| └ | deleteInternalMajorRoutes | External ❗️ | 🛑  | onlyRole |
| └ | removeApproval | External ❗️ | 🛑  | onlyRole |
| └ | createApproval | External ❗️ | 🛑  | onlyRole |
| └ | createLpToken | External ❗️ | 🛑  | onlyRole |
| └ | deleteLpToken | External ❗️ | 🛑  | onlyRole |
| └ | grantRole | Public ❗️ | 🛑  | onlyRole |
| └ | buildRoute | Public ❗️ |   |NO❗️ |
| └ | getMajorRoute | External ❗️ |   |NO❗️ |
| └ | _exchange | Private 🔐 | 🛑  | |
| └ | _enterLiquidityPool | Private 🔐 | 🛑  | |
| └ | _exitLiquidityPool | Private 🔐 | 🛑  | |
| └ | reverseRouteEdge | Private 🔐 |   | |
| └ | <Receive Ether> | External ❗️ |  💵 |NO❗️ |


 Legend

|  Symbol  |  Meaning  |
|:--------:|-----------|
|    🛑    | Function can modify state |
|    💵    | Function is payable |
 

</div>
____
<sub>
Thinking about smart contract security? We can provide training, ongoing advice, and smart contract auditing. [Contact us](https://diligence.consensys.net/contact/).
</sub>

