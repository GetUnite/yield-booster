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
    // mapping(address => uint256) public userWithdrawals;
    address[] public withdrawalqueue;

    address public trustedForwarder;
    address public alluoPool;
    address public fraxPool;
    address public gnosis;

    uint256 public poolId;
    uint256 public rewardsPerShareAccumulated;
    uint256 public adminFee;
    uint256 public vaultRewardsBefore;
    uint256 public duration;

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
        address _fraxPool,
        uint256 _poolId,
        uint256 _duration
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC4626_init(_underlying);
        __ERC20_init(_name, _symbol);
        alluoPool = _alluoPool;
        rewardToken = _rewardToken;
        poolId = _poolId;
        fraxPool = _fraxPool;
        duration = _duration;
        for (uint256 i; i < _yieldTokens.length; i++) {
            yieldTokens.add(_yieldTokens[i]);
        }

        require(_multiSigWallet.isContract(), "AlluoConvexVault: Not contract");
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
    }

    /// @notice Loop called periodically to compound reward tokens into the respective alluo pool
    /// @dev Claims rewards, transfers all rewards to the alluoPool. Then, the pool is farmed and rewards are credited accordingly per share.
    function loopRewards() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // The vaultRewardsBefore is set in the same call right before the rewardToken balance is increased to allow for this calculation to work.
        uint256 vaultRewardAfter = IAlluoPool(alluoPool).rewardTokenBalance();
        uint256 totalRewards = vaultRewardAfter - vaultRewardsBefore;
        if (totalRewards > 0) {
            uint256 totalFees = (totalRewards * adminFee) / 10**4;
            uint256 newRewards = totalRewards - totalFees;
            rewards[gnosis] += totalFees;
            rewardsPerShareAccumulated += (newRewards * 10**18) / totalSupply();
        }
        console.log("Vault reward after", vaultRewardAfter);
        console.log("Vault rewards before", vaultRewardsBefore);
        console.log("Total rewards", totalRewards);
    }

    function claimAndConvertToPoolEntryToken(address entryToken)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256)
    {
        claimRewardsFromPool();
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
                EXCHANGE.exchange(token, address(entryToken), balance, 0);
            }
        }
        vaultRewardsBefore = IAlluoPool(alluoPool).rewardTokenBalance();
        uint256 amount = IERC20MetadataUpgradeable(entryToken).balanceOf(
            address(this)
        );
        IERC20MetadataUpgradeable(entryToken).safeTransfer(alluoPool, amount);
        return amount;
    }

    function accruedRewards() public view returns (RewardData[] memory) {
        (, , , address pool, , ) = CVX_BOOSTER.poolInfo(poolId);
        ICvxBaseRewardPool mainCvxPool = ICvxBaseRewardPool(pool);
        uint256 extraRewardsLength = mainCvxPool.extraRewardsLength();
        RewardData[] memory rewardArray = new RewardData[](
            extraRewardsLength + 1
        );
        rewardArray[0] = RewardData(
            mainCvxPool.rewardToken(),
            mainCvxPool.earned(address(this))
        );
        for (uint256 i; i < extraRewardsLength; i++) {
            ICvxBaseRewardPool extraReward = ICvxBaseRewardPool(
                mainCvxPool.extraRewards(i)
            );
            rewardArray[i + 1] = (
                RewardData(
                    extraReward.rewardToken(),
                    extraReward.earned(address(this))
                )
            );
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

    // /// @notice Stakes all underlying LP tokens that are not already staked.
    // // /// @dev Also claims rewards. This function should be called before loopRewards if Lps are not staked.
    // function stakeUnderlying() external {
    //     IERC20MetadataUpgradeable underlying = IERC20MetadataUpgradeable(
    //         asset()
    //     );
    //     underlying.safeIncreaseAllowance(
    //         address(CVX_BOOSTER),
    //         underlying.balanceOf(address(this))
    //     );
    //     CVX_BOOSTER.deposit(poolId, underlying.balanceOf(address(this)), true);
    //     (, , , address pool, , ) = CVX_BOOSTER.poolInfo(poolId);
    //     ICvxBaseRewardPool(pool).getReward();
    // }

    /// @notice Locks a certain amount of wrapped LP tokens to Frax Convex
    /// @param liquidity an amount of staking token to lock
    function _lockToConvex(uint256 liquidity) internal {
        // check if we already have a kek_id
        IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
            fraxPool
        ).lockedStakesOf(address(this));

        if (lockedstakes.length == 1) {
            bytes32 kek_id = lockedstakes[0].kek_id;
            IFraxFarmERC20(fraxPool).lockAdditional(kek_id, liquidity);
        } else if (lockedstakes.length == 0) {
            IFraxFarmERC20(fraxPool).stakeLocked(liquidity, duration);
        }
    }

    /// @notice Locks all underlying LP tokens that are not already locked.
    /// @dev Also claims rewards. This function should be called before loopRewards if Lps are not staked.
    function lockUnderlying() public {
        address stakingToken = IFraxFarmERC20(fraxPool).stakingToken();
        uint256 liquidity = IERC20Upgradeable(stakingToken).balanceOf(
            address(this)
        );
        IERC20MetadataUpgradeable(stakingToken).safeIncreaseAllowance(
            fraxPool,
            liquidity
        );
        _lockToConvex(liquidity);

        // get FRX rewards if we already have a kek_id
        // ICvxBaseRewardPool(pool).getReward();
    }

    /// @notice Claims all rewards
    /// @dev Used when looping rewards
    function claimRewardsFromPool() public {
        IFraxFarmERC20(fraxPool).getReward(address(this)); // get frax
        (, , , address pool, , ) = CVX_BOOSTER.poolInfo(poolId);
        ICvxBaseRewardPool(pool).getReward(); // get crv and cvx
    }

    /// @notice Accordingly credits the account with accumulated rewards
    /// @dev Gives the correct reward per share using the earned view function and then ensures that this is accounted for.
    /// @param account Shareholder
    function _distributeReward(address account) internal {
        rewards[account] = earned(account);
        userRewardPaid[account] = rewardsPerShareAccumulated;
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

    /// @notice Deposits an amount of LP underlying and mints shares in the vault. Wrapps LP tokens deposited to the vault.
    /// @dev Read the difference between deposit and mint at the start of the contract. Makes sure to distribute rewards before any actions occur
    /// @param assets Amount of assets deposited
    /// @param receiver Recipient of shares
    /// @return shares amount of shares minted
    function deposit(
        uint256 assets,
        address receiver,
        bool lockImmediately
    ) public returns (uint256) {
        _distributeReward(_msgSender()); //no change
        uint256 shares = deposit(assets, receiver);
        _wrapLP(assets);
        if (lockImmediately) {
            // allow users to lockAdditional without waiting for the next locking period
            _lockToConvex(assets);
        }
        return shares;
    }

    /// @notice Deposits an amount of any ERC20 and mints shares in the vault.
    /// @dev Read the difference between deposit and mint at the start of the contract. Makes sure to distribute rewards before any actions occur
    ///      Converts all the entry tokens to a token eligible for adding liquidity. Then carry out same deposit procedure
    /// @param assets Amount of assets deposited
    /// @param entryToken token deposited
    /// @return shares amount of shares minted
    function depositWithoutLP(
        uint256 assets,
        address entryToken,
        bool lockImmediately
    ) public returns (uint256) {
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
        _wrapLP(assets);

        if (lockImmediately) {
            _lockToConvex(assets);
        }

        emit Deposit(_msgSender(), _msgSender(), assets, shares);
        return shares;
    }

    /// @notice Wraps curve LP tokens before staking into Convex
    /// @dev LP tokens are to be wrapped before locking in Convex
    /// @param assets amount of LP tokens to wrap
    function _wrapLP(uint256 assets) internal {
        address fraxWrapper = IFraxFarmERC20(fraxPool).stakingToken();
        IERC20MetadataUpgradeable(asset()).safeIncreaseAllowance(
            fraxWrapper,
            assets
        );
        IConvexWrapper(fraxWrapper).deposit(assets, address(this));
    }

    /// @notice Unwraps curve LP tokens before withdrawals
    /// @dev LP tokens are to be unwrapped
    /// @param assets amount of LP tokens to wrap
    function _unwrapLP(uint256 assets) internal {
        address fraxWrapper = IFraxFarmERC20(fraxPool).stakingToken();
        IConvexWrapper(fraxWrapper).withdrawAndUnwrap(assets);
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

    // function requestWithdrawal(address owner) public {
    //     require(balanceOf(_msgSender()) != 0, "AlluoConvexVault: !shareholder");
    //     withdrawalqueue.add(owner);
    // }

    /** @dev See {IERC4626-withdraw}. */
    /// Standard ERC4626 withdraw function but distributes rewards before withdraw
    //  and unstakes from the alluoPool in order to meet collateral commitments
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        _distributeReward(_msgSender());
        require(
            assets <= maxWithdraw(owner),
            "ERC4626: withdraw more than max"
        );
        // _unstakeForWithdraw(assets);
        uint256 shares = previewWithdraw(assets);
        _unwrapLP(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);
        return shares;
    }

    /// @notice Allows withdrawals in any ERC20 token supported by the Alluo Exchange
    /// @param assets  Amount of vault shares to burn
    /// @param receiver Recipient of the tokens
    /// @param owner Standrad ERC4626 owner
    /// @param exitToken Token that you want to receive by burning shares in the vault and the Lp token
    /// @return uint256 amount of exitToken assets received
    function withdrawToNonLp(
        uint256 assets,
        address receiver,
        address owner,
        address exitToken
    ) public returns (uint256) {
        _distributeReward(_msgSender());
        require(
            assets <= maxWithdraw(owner),
            "ERC4626: withdraw more than max"
        );
        uint256 shares = previewWithdraw(assets);
        _unwrapLP(assets);
        if (_msgSender() != owner) {
            _spendAllowance(owner, _msgSender(), shares);
        }
        _burn(owner, shares);
        IERC20MetadataUpgradeable(asset()).safeIncreaseAllowance(
            address(EXCHANGE),
            shares
        );
        shares = EXCHANGE.exchange(asset(), exitToken, shares, 0);
        IERC20MetadataUpgradeable(exitToken).safeTransfer(receiver, shares);
        return shares;
    }

    /// @param assets  Amount of vault shares to burn
    /// @param receiver Recipient of the tokens
    /// @param owner Standrad ERC4626 owner
    /** @dev See {IERC4626-redeem}. */
    /// Same but simply distributes rewards and unstakes from the alluo pool to meet withdrawals
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        _distributeReward(_msgSender());
        require(shares <= maxRedeem(owner), "ERC4626: redeem more than max");
        uint256 assets = previewRedeem(shares);
        _unwrapLP(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);
        return assets;
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
        if (rewardTokens > 0) {
            rewards[_msgSender()] = 0;
            // Disable for Sepolia
            IAlluoPool(alluoPool).withdraw(rewardTokens);
            rewardToken.safeIncreaseAllowance(address(EXCHANGE), rewardTokens);
            rewardTokens = EXCHANGE.exchange(
                address(rewardToken),
                exitToken,
                rewardTokens,
                0
            );
            IERC20MetadataUpgradeable(exitToken).safeTransfer(
                _msgSender(),
                rewardTokens
            );
        }
        return rewardTokens;
    }

    /// @notice
    /// @dev To be called by resolver every 'duration' period. kek_id is deleted in frax convex pool once all funds are unlocked
    function reLockToFrax() external {
        // 1. Unlock from frax convex
        _unlockFromFraxConvex();

        // 2. Unwrap necessary amount to satisfy withdrawal claims
        uint256 amountToUnwrap = IERC20Upgradeable(asset()).balanceOf(
            address(this)
        ) - _calculateWithdrawals();

        address stakingToken = IFraxFarmERC20(fraxPool).stakingToken();
        IConvexWrapper(stakingToken).withdrawAndUnwrap(amountToUnwrap);

        // 3. Lock remaining to frax convex
        uint256 remainingsToLock = IERC20MetadataUpgradeable(stakingToken)
            .balanceOf(address(this));
        IFraxFarmERC20(fraxPool).stakeLocked(remainingsToLock, duration);
    }

    /// @notice Unlocks all funds from Frax Convex. Wrapped lp tokens are transfered to the vault.
    /// @dev Internal to be called before unwrapping lp tokens.
    function _unlockFromFraxConvex() internal {
        // TODO: check if fxs rewards are distributed automatically
        IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
            fraxPool
        ).lockedStakesOf(address(this));
        if (lockedstakes.length == 1) {
            bytes32 kek_id = lockedstakes[0].kek_id;
            IFraxFarmERC20(fraxPool).withdrawLocked(kek_id, address(this));
        } else return;
    }

    /// @notice Internal function to calculate the sum of withdrawal requests
    /// @dev Used to see how many tokens should be unwrapped before locking the remaining into frax convex again
    /// @return amount number of assets (lp tokens) to unwrap
    function _calculateWithdrawals() internal view returns (uint256 amount) {
        uint256 totalWithdrawalAmount;
        for (uint256 i; i < withdrawalqueue.length; i++) {
            uint256 shares = balanceOf(withdrawalqueue[i]); //
            totalWithdrawalAmount += previewRedeem(shares);
        }
        return totalWithdrawalAmount;
    }

    function totalAssets() public view override returns (uint256) {
        return
            IERC20MetadataUpgradeable(asset()).balanceOf(address(this)) +
            stakedBalanceOf();
    }

    function stakedBalanceOf() public view returns (uint256) {
        (, , , address pool, , ) = CVX_BOOSTER.poolInfo(poolId); // pool id is convex pool ??
        return ICvxBaseRewardPool(pool).balanceOf(address(this));
        // address stakingToken = IFraxFarmERC20(fraxPool).stakingToken();
        // return stakingToken.balanceOf(address(this));
    }

    function lockedBalanceOf() public view returns (uint256) {
        return IFraxFarmERC20(fraxPool).lockedLiquidityOf(address(this));
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        _distributeReward(from);
        _distributeReward(to);
        super._beforeTokenTransfer(from, to, amount);
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
            require(account.isContract(), "AlluoVault: Not contract");
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
