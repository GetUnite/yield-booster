//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./interfaces/IAlluoPool.sol";

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "./interfaces/ICvxBooster.sol";
import "./interfaces/ICvxBaseRewardPool.sol";
import "./interfaces/IExchange.sol";
import "./interfaces/ICurvePool.sol";
import "./interfaces/IConvexWrapper.sol";
import "./interfaces/IFraxFarmERC20.sol";

import "hardhat/console.sol";

contract AlluoConvexVault is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ERC4626Upgradeable
{
    // Deposit vs Mint
    // Deposit is adding an exact amount of underlying tokens
    // Mint is creating an exact amount of shares in the vault, but potentially different number of underlying.

    // Withdraw vs Redeem:
    // Withdraw is withdrawing an exact amount of underlying tokens
    // Redeem is burning an exact amount of shares in the vault

    ICvxBooster public constant CVX_BOOSTER =
        ICvxBooster(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    IExchange public constant EXCHANGE =
        IExchange(0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec);

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant GELATO = keccak256("GELATO");

    mapping(address => uint256) public userRewardPaid;
    mapping(address => uint256) public rewards;
    mapping(address => Shareholder) public userWithdrawals;
    address[] public withdrawalqueue;

    address public trustedForwarder;
    address public alluoPool;
    address public fraxPool;
    address public stakingToken;
    address public gnosis;

    uint256 public poolId;
    uint256 public rewardsPerShareAccumulated;
    uint256 public adminFee;
    uint256 public vaultRewardsBefore;
    uint256 public duration;
    uint256 public totalRequestedWithdrawals;

    bool public upgradeStatus;
    IERC20MetadataUpgradeable public rewardToken;

    EnumerableSetUpgradeable.AddressSet private yieldTokens;
    EnumerableSetUpgradeable.AddressSet private poolTokens;

    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using MathUpgradeable for uint256;

    struct RewardData {
        address token;
        uint256 amount;
    }

    struct Shareholder {
        uint256 id;
        uint256 withdrawalRequested;
        uint256 withdrawalAvailable;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        string memory _name,
        string memory _symbol,
        IERC20MetadataUpgradeable _underlying,
        IERC20MetadataUpgradeable _rewardToken,
        address _alluoPool,
        address _multiSigWallet,
        address _trustedForwarder,
        address[] memory _yieldTokens,
        address _fraxPool
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC4626_init(_underlying);
        __ERC20_init(_name, _symbol);
        alluoPool = _alluoPool;
        rewardToken = _rewardToken;
        fraxPool = _fraxPool;
        for (uint256 i; i < _yieldTokens.length; i++) {
            yieldTokens.add(_yieldTokens[i]);
        }

        require(_multiSigWallet.isContract(), "AlluoVault: Not contract");
        _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
        _grantRole(UPGRADER_ROLE, _multiSigWallet);
        _grantRole(GELATO, _multiSigWallet);

        // // ENABLE ONLY FOR TESTS
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(GELATO, msg.sender);

        gnosis = _multiSigWallet;
        trustedForwarder = _trustedForwarder;
        adminFee = 0;
        duration = 594000;
        stakingToken = IFraxFarmERC20(fraxPool).stakingToken();
        poolId = IConvexWrapper(stakingToken).convexPoolId();
    }

    /// @notice Deposits an amount of LP underlying and mints shares in the vault. Wrapps LP tokens deposited to the vault.
    /// @dev Read the difference between deposit and mint at the start of the contract. Makes sure to distribute rewards before any actions occur
    /// @param assets Amount of assets deposited
    /// @return shares amount of shares minted
    function deposit(uint256 assets) external returns (uint256) {
        _distributeReward(_msgSender());
        uint256 shares = deposit(assets, _msgSender());
        return shares;
    }

    /// @notice Deposits an amount of any ERC20 and mints shares in the vault.
    /// @dev Read the difference between deposit and mint at the start of the contract. Makes sure to distribute rewards before any actions occur
    ///      Converts all the entry tokens to a token eligible for adding liquidity. Then carry out same deposit procedure
    /// @param assets Amount of assets deposited
    /// @param entryToken token deposited
    /// @return shares amount of shares minted
    function depositWithoutLP(uint256 assets, address entryToken)
        external
        returns (uint256)
    {
        _distributeReward(_msgSender());
        IERC20MetadataUpgradeable(entryToken).safeTransferFrom(
            _msgSender(),
            address(this),
            assets
        );
        IERC20MetadataUpgradeable(entryToken).safeIncreaseAllowance(
            address(EXCHANGE),
            assets
        );
        assets = EXCHANGE.exchange(entryToken, asset(), assets, 0);

        require(
            assets <= _nonLpMaxDeposit(assets),
            "ERC4626: deposit more than max"
        );
        uint256 shares = _nonLpPreviewDeposit(assets);
        _mint(_msgSender(), shares);

        emit Deposit(_msgSender(), _msgSender(), assets, shares);
        return shares;
    }

    /** @dev See {IERC4626-mint}.**/
    /// Standard ERC4626 mint function but distributes rewards before deposits
    function mint(uint256 shares, address receiver)
        public
        override
        returns (uint256)
    {
        _distributeReward(_msgSender());
        require(shares <= maxMint(receiver), "ERC4626: mint more than max");
        uint256 assets = previewMint(shares);
        _deposit(_msgSender(), receiver, assets, shares);
        return assets;
    }

    /// @notice Claims all rewards.
    /// @dev Used when looping rewards.
    function claimRewardsFromPool() public {
        IFraxFarmERC20(fraxPool).getReward(address(this)); // get frax
        IConvexWrapper(stakingToken).getReward(address(this)); // get crv and cvx
    }

    /// @notice Claims all rewards from curve and convex pools, converts to cvx and transfers to Alluo Booster Pool.
    /// @dev Called periodically before looping through the rewards and updating reward balances.
    /// @param entryToken entry token to the Alluo Booster Pool.
    /// @return amount amount of entry token transferred to Alluo Booster Pool.
    function claimAndConvertToPoolEntryToken(address entryToken)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256)
    {
        claimRewardsFromPool(); // get fxs, cvx, crv
        for (uint256 i; i < yieldTokens.length(); i++) {
            address token = yieldTokens.at(i);
            uint256 balance = IERC20MetadataUpgradeable(token).balanceOf(
                address(this)
            );
            if (token != address(entryToken) && balance > 0) {
                IERC20MetadataUpgradeable(token).safeIncreaseAllowance(
                    address(EXCHANGE),
                    balance
                );
                EXCHANGE.exchange(token, address(entryToken), balance, 0); // entry token is cvx
            }
        }
        vaultRewardsBefore = IAlluoPool(alluoPool).rewardTokenBalance();
        uint256 amount = IERC20MetadataUpgradeable(entryToken).balanceOf(
            address(this)
        );
        IERC20MetadataUpgradeable(entryToken).safeTransfer(alluoPool, amount);
        return amount;
    }

    /// @notice Returns all accrued frax rewards.
    /// @return RewardData[] An array of addresses and accrued rewards of each reward token.
    function _accruedFraxRewards() internal view returns (RewardData[] memory) {
        address[] memory allFraxRewardTokens = IFraxFarmERC20(fraxPool)
            .getAllRewardTokens();
        uint256[] memory fraxRewardsEarned = IFraxFarmERC20(fraxPool).earned(
            address(this)
        );
        RewardData[] memory rewardArray = new RewardData[](
            allFraxRewardTokens.length
        );
        for (uint256 i; i < allFraxRewardTokens.length; i++) {
            rewardArray[i] = RewardData(
                allFraxRewardTokens[i],
                fraxRewardsEarned[i]
            );
        }
        return rewardArray;
    }

    function _accruedCurveRewards()
        internal
        view
        returns (IConvexWrapper.EarnedData[] memory)
    {
        try IConvexWrapper(stakingToken).earned(address(this)) returns (
            IConvexWrapper.EarnedData[] memory curveRewards
        ) {
            return curveRewards;
        } catch (bytes memory) {
            return IConvexWrapper(stakingToken).earnedView(address(this));
        }
    }

    /// @notice Returns all accrued rewards.
    /// @return RewardData[] An array of addresses and accrued rewards of each reward token.
    function accruedRewards() public view returns (RewardData[] memory) {
        RewardData[] memory fraxRewards = _accruedFraxRewards();
        IConvexWrapper.EarnedData[]
            memory curveRewards = _accruedCurveRewards();
        RewardData[] memory rewardArray = new RewardData[](
            fraxRewards.length + curveRewards.length
        );

        for (uint256 i; i < fraxRewards.length; i++) {
            RewardData memory reward = RewardData(
                fraxRewards[i].token,
                fraxRewards[i].amount +
                    IERC20MetadataUpgradeable(fraxRewards[i].token).balanceOf(
                        address(this)
                    )
            );
            rewardArray[i] = reward;
        }

        for (uint256 i; i < curveRewards.length; i++) {
            RewardData memory reward = RewardData(
                curveRewards[i].token,
                curveRewards[i].amount +
                    IERC20MetadataUpgradeable(curveRewards[i].token).balanceOf(
                        address(this)
                    )
            );
            rewardArray[fraxRewards.length + i] = reward;
        }

        return rewardArray;
    }

    function shareholderAccruedRewards(address shareholder)
        public
        view
        returns (RewardData[] memory, IAlluoPool.RewardData[] memory)
    {
        RewardData[] memory vaultAccruals = accruedRewards();
        IAlluoPool.RewardData[] memory poolAccruals = IAlluoPool(alluoPool)
            .accruedRewards();
        uint256 shares = balanceOf(shareholder);
        uint256 totalSupplyShares = totalSupply();
        uint256 poolTotalBalances = IAlluoPool(alluoPool).totalBalances();

        for (uint256 i; i < vaultAccruals.length; i++) {
            if (totalSupplyShares == 0) {
                break;
            }
            uint256 userShareOfVaultAccruals = (vaultAccruals[i].amount *
                shares) / totalSupplyShares;
            vaultAccruals[i].amount = userShareOfVaultAccruals;
        }
        for (uint256 i; i < poolAccruals.length; i++) {
            if (poolTotalBalances == 0) {
                break;
            }
            uint256 vaultShareOfPoolAccruals = (poolAccruals[i].amount *
                IAlluoPool(alluoPool).balances(address(this))) /
                poolTotalBalances;
            poolAccruals[i].amount =
                (vaultShareOfPoolAccruals * shares) /
                totalSupplyShares;
        }
        return (vaultAccruals, poolAccruals);
    }

    /// @notice Calculates the total amount of undistributed rewards an account has a claim to
    /// @dev First calculate the amount per share not paid and then multiply this by the amount of shares the user owns.
    /// @param account Shareholder
    function earned(address account) public view returns (uint256) {
        uint256 rewardsDelta = rewardsPerShareAccumulated -
            userRewardPaid[account];
        uint256 undistributedRewards = (balanceOf(account) * rewardsDelta) /
            10**18;
        return undistributedRewards + rewards[account];
    }

    /// @notice Accordingly credits the account with accumulated rewards
    /// @dev Gives the correct reward per share using the earned view function and then ensures that this is accounted for.
    /// @param account Shareholder
    function _distributeReward(address account) internal {
        rewards[account] = earned(account);
        userRewardPaid[account] = rewardsPerShareAccumulated;
    }

    /// @notice Puts a withdrawal request to be satisfied after the next farming cycle
    /// @dev Called by withdraw() and redeem()
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        _distributeReward(_msgSender());
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        uint256 maxWithdrawableAssets = previewRedeem(maxRedeem(owner));
        require(
            userWithdrawals[owner].withdrawalRequested + assets <=
                maxWithdrawableAssets,
            "AlluoVault: withdraw more than max"
        );

        if (userWithdrawals[owner].withdrawalRequested == 0) {
            withdrawalqueue.push(owner);
            userWithdrawals[owner].id = withdrawalqueue.length; // will alsways be > 0
        }

        userWithdrawals[owner].withdrawalRequested += assets;

        emit Withdraw(caller, receiver, owner, assets, shares); //should we keep event here?
    }

    /// @notice Claims the unlocked funds previously requested for withdrawal
    /// @dev Unwraps claimed lp tokens, exchanges them to the exit token and sends to the user
    /// @param exitToken the token to be transferred to the user
    /// @param receiver Recipient of the tokens
    function claim(address exitToken, address receiver)
        public
        virtual
        returns (uint256)
    {
        uint256 amount = userWithdrawals[receiver].withdrawalAvailable;
        require(amount > 0, "AlluoVault: no withdrawals available");

        totalRequestedWithdrawals -= amount;
        delete userWithdrawals[receiver];

        IConvexWrapper(stakingToken).withdrawAndUnwrap(amount);
        if (exitToken != asset()) {
            IERC20MetadataUpgradeable(asset()).safeIncreaseAllowance(
                address(EXCHANGE),
                amount
            );
            amount = EXCHANGE.exchange(asset(), exitToken, amount, 0);
        }
        IERC20MetadataUpgradeable(exitToken).safeTransfer(receiver, amount);

        //todo: emit claim satisfied event
        return amount;
    }

    /// @notice Allows users to claim their rewards
    /// @dev Withdraws all reward tokens from the alluo pool and sends it to the user.
    /// @return Uint256 value of total reward tokens
    function claimRewards() public returns (uint256) {
        _distributeReward(_msgSender());
        uint256 rewardTokens = rewards[_msgSender()];
        if (rewardTokens > 0) {
            rewards[_msgSender()] = 0;
            // Disable for Sepolia
            IAlluoPool(alluoPool).withdraw(rewardTokens);
            rewardToken.safeTransfer(_msgSender(), rewardTokens);
        }
        return rewardTokens;
    }

    /// @notice Allows users to claim their rewards in an ERC20 supported by the Alluo exchange
    /// @dev Withdraws all reward tokens from the alluo pool and sends it to the user after exchanging it.
    /// @return Uint256 value of total reward tokens in exitTokens
    function claimRewardsInNonLp(address exitToken) public returns (uint256) {
        _distributeReward(_msgSender());
        uint256 rewardTokens = rewards[_msgSender()];
        console.log("AGA!", rewardTokens);
        if (rewardTokens > 0) {
            rewards[_msgSender()] = 0;
            // Disable for Sepolia
            IAlluoPool(alluoPool).withdraw(rewardTokens);
            console.log("ot stilki vyvodym", rewardTokens);
            rewardToken.safeIncreaseAllowance(address(EXCHANGE), rewardTokens);
            rewardTokens = EXCHANGE.exchange(
                address(rewardToken),
                exitToken,
                rewardTokens,
                0
            );
            console.log(exitToken);
            IERC20MetadataUpgradeable(exitToken).safeTransfer(
                _msgSender(),
                rewardTokens
            );
        }
        return rewardTokens;
    }

    /// @notice Wraps curve LP tokens before staking into Convex
    /// @dev LP tokens are to be wrapped before locking in Convex
    /// @param assets amount of LP tokens to wrap
    function _wrapLP(uint256 assets) internal {
        IERC20MetadataUpgradeable(asset()).safeIncreaseAllowance(
            stakingToken,
            assets
        );
        IConvexWrapper(stakingToken).deposit(assets, address(this));
    }

    /// @dev To be called periodically by resolver. kek_id is deleted in frax convex pool once all funds are unlocked
    function stakeUnderlying() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // 1. Wrap Lps
        uint256 assets = IERC20MetadataUpgradeable(asset()).balanceOf(
            address(this)
        );
        // console.log("User lp dep", assets);
        if (assets > 0) {
            _wrapLP(assets);
        }
        console.log("wrap", assets);

        // 2. Lock additional
        uint256 wrappedBalance = IConvexWrapper(stakingToken).balanceOf(
            address(this)
        );
        console.log("wrap", wrappedBalance);
        // console.log("wrapped balance", wrappedBalance);
        if (wrappedBalance > 0) {
            IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
                fraxPool
            ).lockedStakesOf(address(this));

            IERC20MetadataUpgradeable(stakingToken).safeIncreaseAllowance(
                fraxPool,
                wrappedBalance
            );
            if (lockedstakes.length == 1) {
                IFraxFarmERC20(fraxPool).lockAdditional(
                    lockedstakes[0].kek_id,
                    wrappedBalance
                );
                // console.log("locked");
            } else if (lockedstakes.length == 0) {
                IFraxFarmERC20(fraxPool).stakeLocked(wrappedBalance, duration);
                // console.log("ne locked");
            }
        }
    }

    /// @notice Burns share of users in the withdrawal queue
    /// @dev Internal function to be called only when funds are unlocked from Frax
    function _processWithdrawalRequests() internal returns (uint256) {
        uint256 totalNumberOfWithdrawals = withdrawalqueue.length;
        uint256 newUnsatisfiedWithdrawals;
        if (totalNumberOfWithdrawals != 0) {
            for (uint256 i = totalNumberOfWithdrawals; i > 0; i--) {
                uint256 requestedAmount = userWithdrawals[
                    withdrawalqueue[i - 1]
                ].withdrawalRequested;
                uint256 shares = previewWithdraw(requestedAmount);
                _burn(withdrawalqueue[i - 1], shares);
                newUnsatisfiedWithdrawals += requestedAmount; // to calculate remainings to lock
                totalRequestedWithdrawals += requestedAmount; // to balance out totalAssets()
                userWithdrawals[withdrawalqueue[i - 1]]
                    .withdrawalAvailable += requestedAmount;
                userWithdrawals[withdrawalqueue[i - 1]]
                    .withdrawalRequested -= requestedAmount;
                withdrawalqueue.pop();
            }
        }
        return newUnsatisfiedWithdrawals;
    }

    function _relockToFrax() internal {
        // 1. unlock from frax if possible
        IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
            fraxPool
        ).lockedStakesOf(address(this));

        if (lockedstakes.length == 1) {
            if (lockedstakes[0].ending_timestamp < block.timestamp) {
                console.log("lock zakinchuetsa", lockedstakes[0].ending_timestamp);
                IFraxFarmERC20(fraxPool).withdrawLocked(
                    lockedstakes[0].kek_id,
                    address(this)
                ); // claims rewards from frax

                IFraxFarmERC20(fraxPool).getReward(address(this));

                // 2. Updates userWithdrawals mapping, burns shares of those in the queue and clears withdrawal queue
                uint256 newUnsatisfiedWithdrawals = _processWithdrawalRequests();
                console.log("Unsatisfied", newUnsatisfiedWithdrawals);

                // 3. Lock remaining to frax convex
                uint256 remainingsToLock = IERC20MetadataUpgradeable(
                    stakingToken
                ).balanceOf(address(this)) - newUnsatisfiedWithdrawals;
                if (remainingsToLock > 0) {
                    IERC20MetadataUpgradeable(stakingToken)
                        .safeIncreaseAllowance(fraxPool, remainingsToLock);
                    IFraxFarmERC20(fraxPool).stakeLocked(
                        remainingsToLock,
                        duration
                    );
                }
            }
        } // should we add stakeLocked if lockedstakes.length == 0 ?
    }

    /// @notice Loop called periodically to compound reward tokens into the respective alluo pool
    /// @dev Claims rewards, transfers all rewards to the alluoPool. Then, the pool is farmed and rewards are credited accordingly per share.
    function loopRewards() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _relockToFrax();
        uint256 vaultRewardAfter = IAlluoPool(alluoPool).rewardTokenBalance();
        uint256 totalRewards = vaultRewardAfter - vaultRewardsBefore;
        if (totalRewards > 0) {
            uint256 totalFees = (totalRewards * adminFee) / 10**4;
            uint256 newRewards = totalRewards - totalFees;
            rewards[gnosis] += totalFees;
            rewardsPerShareAccumulated += (newRewards * 10**18) / totalSupply();
        }
        console.log("Swang afric", vaultRewardAfter);
        console.log("Bershka", vaultRewardsBefore);
        console.log("Toman", totalRewards);
    }

    /// @notice Unlocks all funds from Frax Convex. Wrapped lp tokens are transfered to the vault.
    function unlockFromFraxConvex() external onlyRole(DEFAULT_ADMIN_ROLE) {
        IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
            fraxPool
        ).lockedStakesOf(address(this));
        if (lockedstakes.length == 1) {
            bytes32 kek_id = lockedstakes[0].kek_id;
            IFraxFarmERC20(fraxPool).withdrawLocked(kek_id, address(this));
        } else return;
    }

    function totalAssets() public view override returns (uint256) {
        return
            IERC20MetadataUpgradeable(asset()).balanceOf(address(this)) +
            stakedBalance() +
            lockedBalance() -
            totalRequestedWithdrawals;
    }

    function stakedBalance() public view returns (uint256) {
        return IERC20MetadataUpgradeable(stakingToken).balanceOf(address(this));
    }

    function lockedBalance() public view returns (uint256) {
        return IFraxFarmERC20(fraxPool).lockedLiquidityOf(address(this));
    }

    function _nonLpMaxDeposit(uint256 assets) internal view returns (uint256) {
        return
            totalAssets() - assets > 0 || totalSupply() == 0
                ? type(uint256).max
                : 0;
    }

    function _nonLpPreviewDeposit(uint256 assets)
        internal
        view
        returns (uint256)
    {
        uint256 supply = totalSupply();
        return
            (assets == 0 || supply == 0)
                ? assets
                : assets.mulDiv(
                    supply,
                    totalAssets() - assets,
                    MathUpgradeable.Rounding.Down
                );
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        _distributeReward(from);
        _distributeReward(to);

        if (
            userWithdrawals[from].withdrawalRequested != 0 && to != address(0)
        ) {
            userWithdrawals[to].withdrawalRequested += userWithdrawals[from]
                .withdrawalRequested;
            // remove old owner from withdrawalqueue
            uint256 ownerId = userWithdrawals[from].id;
            withdrawalqueue[ownerId] = withdrawalqueue[
                withdrawalqueue.length - 1
            ];
            withdrawalqueue.pop();
            userWithdrawals[withdrawalqueue[ownerId]].id = ownerId;

            // add new owner to withdrawalqueue if they are not there already
            if (userWithdrawals[to].id == 0) {
                withdrawalqueue.push(to);
                userWithdrawals[to].id = withdrawalqueue.length;
            }

            delete userWithdrawals[from];
        }
        super._beforeTokenTransfer(from, to, amount);
    }

    function changeLockingDuration(uint256 newDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        duration = newDuration;
    }

    function setPool(address _pool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        alluoPool = _pool;
    }

    function addPoolTokens(address _token)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        poolTokens.add(_token);
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

    function setAdminFee(uint256 fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        adminFee = fee;
    }

    function grantRole(bytes32 role, address account)
        public
        override
        onlyRole(getRoleAdmin(role))
    {
        if (role == DEFAULT_ADMIN_ROLE) {
            require(account.isContract(), "AlluoVault: !contract");
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
