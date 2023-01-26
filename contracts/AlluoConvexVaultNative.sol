//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import {ICvxBooster} from "./interfaces/ICvxBooster.sol";
import {IExchange} from "./interfaces/IExchange.sol";
import {IConvexWrapper} from "./interfaces/IConvexWrapper.sol";
import {IFraxFarmERC20} from "./interfaces/IFraxFarmERC20.sol";
import {IAlluoPool} from "./interfaces/IAlluoPool.sol";
import {IWrappedEther} from "./interfaces/IWrappedEther.sol";

// import "hardhat/console.sol";

contract AlluoConvexVaultNative is
    Initializable,
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

    uint256 public rewardsPerShareAccumulated;
    uint256 public adminFee;
    uint256 public vaultRewardsBefore;
    uint256 public duration;
    uint256 public totalRequestedWithdrawals;

    bool public upgradeStatus;
    IERC20MetadataUpgradeable public rewardToken;

    EnumerableSetUpgradeable.AddressSet private yieldTokens;

    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using MathUpgradeable for uint256;

    event Claim(
        address indexed exitToken,
        uint256 indexed amount,
        address indexed receiver
    );
    event ClaimRewards(
        address indexed exitToken,
        uint256 indexed rewardTokeans,
        address owner
    );

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

        require(_multiSigWallet.isContract(), "AlluoVault: !contract");
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
    }

    /// @notice Deposits an amount of LP underlying and mints shares in the vault.
    /// @dev Read the difference between deposit and mint at the start of the contract. Makes sure to distribute rewards before any actions occur
    /// @param assets Amount of assets deposited
    /// @param receiver Recipient of shares
    /// @return shares amount of shares minted
    function deposit(uint256 assets, address receiver)
        public
        override
        returns (uint256 shares)
    {
        _distributeReward(_msgSender());
        require(
            assets <= maxDeposit(receiver),
            "ERC4626: deposit more than max"
        );
        shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);
    }

    /// @notice Deposits an amount of any ERC20 and mints shares in the vault.
    /// @dev Read the difference between deposit and mint at the start of the contract. Makes sure to distribute rewards before any actions occur
    ///      Converts all the entry tokens to a token eligible for adding liquidity. Then carry out same deposit procedure
    /// @param assets Amount of assets deposited
    /// @param entryToken token deposited
    /// @return shares amount of shares minted
    function depositWithoutLP(uint256 assets, address entryToken)
        external
        payable
        returns (uint256 shares)
    {
        _distributeReward(_msgSender());

        if (entryToken == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            // require(msg.value == assets, "AlluoVault: wrong value");
            IWrappedEther(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).deposit{
                value: msg.value
            }();
            entryToken = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        } else {
            IERC20MetadataUpgradeable(entryToken).safeTransferFrom(
                _msgSender(),
                address(this),
                assets
            );
        }

        IERC20MetadataUpgradeable(entryToken).safeIncreaseAllowance(
            address(EXCHANGE),
            assets
        );
        assets = EXCHANGE.exchange(entryToken, asset(), assets, 0);

        require(assets <= _nonLpMaxDeposit(assets), "ERC4626: deposit>max");
        shares = _nonLpPreviewDeposit(assets);
        _mint(_msgSender(), shares);

        emit Deposit(_msgSender(), _msgSender(), assets, shares);
    }

    /** @dev See {IERC4626-mint}.**/
    /// Standard ERC4626 mint function but distributes rewards before deposits
    function mint(uint256 shares, address receiver)
        public
        override
        returns (uint256)
    {
        _distributeReward(_msgSender());
        require(shares <= maxMint(receiver), "ERC4626: mint>max");
        _deposit(_msgSender(), receiver, previewMint(shares), shares);
        return previewMint(shares);
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
        returns (uint256 amount)
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
        amount = IERC20MetadataUpgradeable(entryToken).balanceOf(address(this));
        IERC20MetadataUpgradeable(entryToken).safeTransfer(alluoPool, amount);
    }

    /// @notice Returns all accrued frax rewards.
    /// @return rewardArray An array of addresses and accrued rewards of each reward token.
    function _accruedFraxRewards()
        internal
        view
        returns (RewardData[] memory rewardArray)
    {
        address[] memory allFraxRewardTokens = IFraxFarmERC20(fraxPool)
            .getAllRewardTokens();
        rewardArray = new RewardData[](allFraxRewardTokens.length);
        for (uint256 i; i < allFraxRewardTokens.length; i++) {
            rewardArray[i] = RewardData(
                allFraxRewardTokens[i],
                IFraxFarmERC20(fraxPool).earned(address(this))[i]
            );
        }
    }

    /// @notice Returns all accrued curve rewards.
    /// @return EarnedData[] An array of addresses and accrued rewards of each reward token.
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
    /// @return rewardArray An array of addresses and accrued rewards of each reward token.
    function accruedRewards()
        public
        view
        returns (RewardData[] memory rewardArray)
    {
        RewardData[] memory fraxRewards = _accruedFraxRewards();
        IConvexWrapper.EarnedData[]
            memory curveRewards = _accruedCurveRewards();
        rewardArray = new RewardData[](
            fraxRewards.length + curveRewards.length
        );

        for (uint256 i; i < fraxRewards.length; i++) {
            rewardArray[i] = RewardData(
                fraxRewards[i].token,
                fraxRewards[i].amount +
                    IERC20MetadataUpgradeable(fraxRewards[i].token).balanceOf(
                        address(this)
                    )
            );
        }

        for (uint256 i; i < curveRewards.length; i++) {
            rewardArray[fraxRewards.length + i] = RewardData(
                curveRewards[i].token,
                curveRewards[i].amount +
                    IERC20MetadataUpgradeable(curveRewards[i].token).balanceOf(
                        address(this)
                    )
            );
        }
    }

    function shareholderAccruedRewards(address shareholder)
        public
        view
        returns (RewardData[] memory, IAlluoPool.RewardData[] memory)
    {
        RewardData[] memory vaultAccruals = accruedRewards();
        IAlluoPool.RewardData[] memory poolAccruals = IAlluoPool(alluoPool)
            .accruedRewards();
        for (uint256 i; i < vaultAccruals.length; i++) {
            if (totalSupply() == 0) {
                break;
            }
            vaultAccruals[i].amount =
                (vaultAccruals[i].amount * balanceOf(shareholder)) /
                totalSupply();
        }
        for (uint256 i; i < poolAccruals.length; i++) {
            if (IAlluoPool(alluoPool).totalBalances() == 0) {
                break;
            }
            uint256 vaultShareOfPoolAccruals = (poolAccruals[i].amount *
                IAlluoPool(alluoPool).balances(address(this))) /
                IAlluoPool(alluoPool).totalBalances();
            poolAccruals[i].amount =
                (vaultShareOfPoolAccruals * balanceOf(shareholder)) /
                totalSupply();
        }
        return (vaultAccruals, poolAccruals);
    }

    /// @notice Calculates the total amount of undistributed rewards an account has a claim to
    /// @dev First calculate the amount per share not paid and then multiply this by the amount of shares the user owns.
    /// @param account Shareholder
    function earned(address account) public view returns (uint256) {
        uint256 undistributedRewards = (balanceOf(account) *
            (rewardsPerShareAccumulated - userRewardPaid[account])) / 10**18;
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
        // `withdrawalRequested` is the amount of assets already requested for withdrawal but not yet claimed
        // We should check if the amount already requested plus the new request is not more than a user's deposit
        require(
            userWithdrawals[owner].withdrawalRequested + assets <=
                previewRedeem(maxRedeem(owner))
        );
        // `id` is needed to handle requested withdrawals when Vault shares are transferred
        // `withdrawalqueue` is needed to go through a loop in `_processWithdrawalRequests()` and sum all requests to keep necessary amount of LPs on the contract
        if (userWithdrawals[owner].withdrawalRequested == 0) {
            withdrawalqueue.push(owner);
            userWithdrawals[owner].id = withdrawalqueue.length; // will alsways be > 0
        }
        // `withdrawalRequested` cannot be decreased, user can only add to the amount already requested
        userWithdrawals[owner].withdrawalRequested += assets;
        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    /// @notice Claims the unlocked funds previously requested for withdrawal
    /// @dev Unwraps claimed lp tokens, exchanges them to the exit token and sends to the user
    /// @param exitToken the token to be transferred to the user
    /// @param receiver Recipient of the tokens
    function claim(address exitToken, address receiver)
        external
        virtual
        returns (uint256 amount)
    {
        amount = userWithdrawals[receiver].withdrawalAvailable;
        if (amount > 0) {
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
        }
        emit Claim(exitToken, amount, receiver);
    }

    /// @notice Allows users to claim their rewards in an ERC20 supported by the Alluo exchange
    /// @dev Withdraws all reward tokens from the alluo pool and sends it to the user after exchanging it.
    /// @return rewardTokens value of total reward tokens in exitTokens
    function claimRewards(address exitToken)
        external
        returns (uint256 rewardTokens)
    {
        _distributeReward(_msgSender());
        rewardTokens = rewards[_msgSender()];
        if (rewardTokens > 0) {
            rewards[_msgSender()] = 0;
            IAlluoPool(alluoPool).withdraw(rewardTokens);
            if (exitToken != address(rewardToken)) {
                rewardToken.safeIncreaseAllowance(
                    address(EXCHANGE),
                    rewardTokens
                );
                rewardTokens = EXCHANGE.exchange(
                    address(rewardToken),
                    exitToken,
                    rewardTokens,
                    0
                );
            }
            IERC20MetadataUpgradeable(exitToken).safeTransfer(
                _msgSender(),
                rewardTokens
            );
        }
        emit ClaimRewards(exitToken, rewardTokens, _msgSender());
    }

    /// @dev To be called periodically by resolver. kek_id is deleted in frax convex pool once all funds are unlocked
    function stakeUnderlying() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // 1. Wrap Lps
        uint256 assets = IERC20MetadataUpgradeable(asset()).balanceOf(
            address(this)
        );
        if (assets > 0) {
            IERC20MetadataUpgradeable(asset()).safeIncreaseAllowance(
                stakingToken,
                assets
            );
            IConvexWrapper(stakingToken).deposit(assets, address(this));
        }

        // 2. Lock additional
        if (
            IConvexWrapper(stakingToken).balanceOf(address(this)) >
            totalRequestedWithdrawals
        ) {
            uint256 wrappedBalance = IConvexWrapper(stakingToken).balanceOf(
                address(this)
            ) - totalRequestedWithdrawals;
            IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
                fraxPool
            ).lockedStakesOf(address(this));

            IERC20MetadataUpgradeable(stakingToken).safeIncreaseAllowance(
                fraxPool,
                wrappedBalance
            );
            if (
                lockedstakes.length == 0 ||
                lockedstakes[lockedstakes.length - 1].ending_timestamp == 0
            ) {
                IFraxFarmERC20(fraxPool).stakeLocked(wrappedBalance, duration);
            } else {
                IFraxFarmERC20(fraxPool).lockAdditional(
                    lockedstakes[lockedstakes.length - 1].kek_id,
                    wrappedBalance
                );
            }
        }
    }

    /// @notice Burns share of users in the withdrawal queue
    /// @dev Internal function to be called only when funds are unlocked from Frax
    function _processWithdrawalRequests() internal returns (uint256) {
        uint256 newUnsatisfiedWithdrawals;
        if (withdrawalqueue.length != 0) {
            for (uint256 i = withdrawalqueue.length; i > 0; i--) {
                uint256 requestedAmount = userWithdrawals[
                    withdrawalqueue[i - 1]
                ].withdrawalRequested;
                _burn(withdrawalqueue[i - 1], previewWithdraw(requestedAmount));
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

    /// @notice Unlocks funds from frax convex, keeps enough to satisfy withdrawal claims and locks the remaining back
    /// @dev To be called inside loopRewards() tirggered by Alluo Vault farm()
    function _relockToFrax() internal {
        // 1. unlock from frax if possible
        IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
            fraxPool
        ).lockedStakesOf(address(this));

        if (
            lockedstakes.length != 0 &&
            lockedstakes[lockedstakes.length - 1].ending_timestamp != 0
        ) {
            if (
                lockedstakes[lockedstakes.length - 1].ending_timestamp <
                block.timestamp
            ) {
                IFraxFarmERC20(fraxPool).withdrawLocked(
                    lockedstakes[lockedstakes.length - 1].kek_id,
                    address(this)
                ); // claims rewards from frax

                // 2. Updates userWithdrawals mapping, burns shares of those in the queue and clears withdrawal queue
                uint256 newUnsatisfiedWithdrawals = _processWithdrawalRequests();

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
        }
    }

    /// @notice Loop called periodically to compound reward tokens into the respective alluo pool
    /// @dev Claims rewards, transfers all rewards to the alluoPool. Then, the pool is farmed and rewards are credited accordingly per share.
    function loopRewards() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 totalRewards = IAlluoPool(alluoPool).rewardTokenBalance() -
            vaultRewardsBefore;
        if (totalRewards > 0) {
            uint256 totalFees = (totalRewards * adminFee) / 10**4;
            uint256 newRewards = totalRewards - totalFees;
            rewards[gnosis] += totalFees;
            rewardsPerShareAccumulated += (newRewards * 10**18) / totalSupply();
        }
        _relockToFrax();

        // console.log(
        //     "Vault reward after",
        //     IAlluoPool(alluoPool).rewardTokenBalance()
        // );
        // console.log("Frax Vault rewards before", vaultRewardsBefore);
        // console.log("Frax Total rewards", totalRewards);
    }

    /// @notice Unlocks all funds from Frax Convex. Wrapped lp tokens are transfered to the vault.
    function unlockFromFraxConvex() external onlyRole(DEFAULT_ADMIN_ROLE) {
        IFraxFarmERC20.LockedStake[] memory lockedstakes = IFraxFarmERC20(
            fraxPool
        ).lockedStakesOf(address(this));
        if (
            lockedstakes.length != 0 &&
            lockedstakes[lockedstakes.length - 1].ending_timestamp <=
            block.timestamp
        ) {
            IFraxFarmERC20(fraxPool).withdrawLocked(
                lockedstakes[lockedstakes.length - 1].kek_id,
                address(this)
            );
        } else return;
    }

    function totalAssets() public view override returns (uint256) {
        return
            IERC20MetadataUpgradeable(asset()).balanceOf(address(this)) +
            stakedBalance() +
            lockedBalance() -
            totalRequestedWithdrawals; // wrapped lps left on the contract to satisfy users' claims
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
        // the logic below handles the changes to be made in `userWithdrawals` mapping when shares are tranferred
        if (
            userWithdrawals[from].withdrawalRequested != 0 && to != address(0)
        ) {
            userWithdrawals[to].withdrawalRequested += userWithdrawals[from]
                .withdrawalRequested;
            // remove old owner from withdrawalqueue
            uint256 ownerId = userWithdrawals[from].id;
            withdrawalqueue[ownerId - 1] = withdrawalqueue[
                withdrawalqueue.length - 1
            ];
            userWithdrawals[withdrawalqueue[ownerId - 1]].id = ownerId;
            withdrawalqueue.pop();

            // add new owner to withdrawal queue if they are not there already
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
        require(upgradeStatus, "IbAlluo: !Upgrade-allowed");
        upgradeStatus = false;
    }
}
