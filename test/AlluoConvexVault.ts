import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { afterEach, before } from "mocha";
import { Exchange, AlluoVaultPool, IAlluoPool, ICurvePool, ICvxBooster, IERC20MetadataUpgradeable, IExchange, AlluoConvexVault, IFraxFarmERC20, IConvexWrapper } from "../typechain";


async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

describe("Dola Frax Alluo Vault Upgradeable Tests", function () {

    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable,
        crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable,
        rewardToken: IERC20MetadataUpgradeable, ethFrxEthLp: IERC20MetadataUpgradeable, fxs: IERC20MetadataUpgradeable,
        stakingToken: IConvexWrapper;
    let cvxBooster: ICvxBooster;
    let exchange: Exchange;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault: AlluoConvexVault;
    let alluoPool: IAlluoPool;
    let ethFrxEthPool: IFraxFarmERC20;
    let admin: SignerWithAddress;

    async function getImpersonatedSigner(address: string): Promise<SignerWithAddress> {
        await ethers.provider.send(
            'hardhat_impersonateAccount',
            [address]
        );

        return await ethers.getSigner(address);
    }

    async function resetNetwork() {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 16428096,
                },
            },],
        });
    }

    before(async () => {

        await resetNetwork();

        console.log('\n', "||| Confirm that the _grantRoles(.., msg.sender) in AlluoVaultUpgradeable.sol has been uncommented to ensure tests are functioning correctly |||", '\n')

    });

    beforeEach(async () => {

        await resetNetwork();
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        usdt = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
        crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
        cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        cvxBooster = await ethers.getContractAt("ICvxBooster", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        ethFrxEthLp = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xf43211935C781D5ca1a41d2041F397B8A7366C7A");
        ethFrxEthPool = await ethers.getContractAt("IFraxFarmERC20", "0xa537d64881b84faffb9Ae43c951EEbF368b71cdA");
        fxs = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0");
        stakingToken = await ethers.getContractAt("IConvexWrapper", "0x4659d5fF63A1E1EDD6D5DD9CC315e063c95947d0");
        admin = await getImpersonatedSigner("0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3");

        // console.log('LP balance before - ', await ethFrxEthLp.balanceOf(signers[0].address));

        const value = parseEther("2000.0");
        const duration = 600000;

        await exchange.exchange(
            ZERO_ADDR, usdc.address, value, 0, { value: value }
        )
        await exchange.exchange(
            ZERO_ADDR, frax.address, value, 0, { value: value }
        )
        await exchange.exchange(
            ZERO_ADDR, usdt.address, value, 0, { value: value }
        )
        await exchange.exchange(
            ZERO_ADDR, ethFrxEthLp.address, value, 0, { value: value }
        )

        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3";
        let AlluoConvexVault = await ethers.getContractFactory("AlluoConvexVault")
        AlluoVault = await upgrades.deployProxy(AlluoConvexVault, [
            "Eth-frxEth Vault",
            "Eth-frxEth",
            ethFrxEthLp.address, // underlying token
            rewardToken.address, // Curve CVX-ETH Convex Deposit (cvxcrvCVX...)
            ZERO_ADDR, // set pool later
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693", // trusted wallet for meta transactions
            [crv.address, cvx.address, fxs.address], // yield tokens
            ethFrxEthPool.address,
            // stakingToken.address,
            // duration
        ], {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoConvexVault;

        alluoPool = await ethers.getContractAt("AlluoVaultPool", "0x470e486acA0e215C925ddcc3A9D446735AabB714");
        await alluoPool.connect(admin).editVault(true, AlluoVault.address);

        await AlluoVault.setPool(alluoPool.address);
        await AlluoVault.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)

    });

    // afterEach(async () => {
    //     expect(await AlluoVault.totalSupply()).equal(await AlluoVault.totalAssets());
    // });

    it.only("Deposit some LP without immediate locking into frax convex", async function () {

        const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
        console.log("LP balance before depositing should be >0:", lpBalance)
        await ethFrxEthLp.approve(AlluoVault.address, lpBalance);
        await AlluoVault["deposit(uint256)"](lpBalance);
        console.log("Shares after should be >0:", await AlluoVault.balanceOf(signers[0].address));
        console.log('LP of signer after should be zero:', await ethFrxEthLp.balanceOf(signers[0].address));
        expect(Number(await AlluoVault.balanceOf(signers[0].address))).greaterThan(0);
        expect(Number(lpBalance)).equal(Number(await AlluoVault.balanceOf(signers[0].address)));

    })

    // it.only("Deposit some LP and wait for rewards to accumulate", async function () {
    //     const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
    //     console.log("LP balance before", lpBalance)
    //     await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault["deposit(uint256)"](lpBalance);
    //     await AlluoVault.stakeUnderlying();
    //     await skipDays(10);
    //     console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

    //     await AlluoVault.claimRewardsFromPool();

    //     const crvAccumulated = await crv.balanceOf(AlluoVault.address);
    //     const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
    //     const fxsAccumulated = await fxs.balanceOf(AlluoVault.address);
    //     console.log(crvAccumulated)
    //     console.log(cvxAccumulated)
    //     console.log(fxsAccumulated)
    //     expect(Number(crvAccumulated)).greaterThan(0)
    //     expect(Number(cvxAccumulated)).greaterThan(0)
    //     expect(Number(fxsAccumulated)).greaterThan(0)

    //     // check if fxs rewards are accumulated after withdrawlocked

    // });

    // it.only("Deposit N/2 tokens twice and lockAdditional before the end of cycle. Should have N tokens locked", async function () {
    //     const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
    //     console.log("LP balance before", lpBalance)
    //     await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();
    //     await skipDays(3);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();

    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance);

    // })

    // it.only("Deposit N tokens twice, request withdrawal, do one cycle. Should have N locked and N available for withdrawal", async function () {
    //     const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
    //     console.log("LP balance before", lpBalance)
    //     await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();
    //     await skipDays(8);

    //     await AlluoVault.requestWithdrawal(lpBalance.div(2), signers[0].address);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();

    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.gt(0);
    //     expect(await ethFrxEthLp.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));

    // })

    // it.only("Deposit N tokens twice, request withdrawal and relock before the end of cycle. Should have 2N locked", async function () {
    //     const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
    //     console.log("LP balance before", lpBalance)
    //     await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();
    //     await skipDays(3);

    //     await AlluoVault.requestWithdrawal(lpBalance.div(2), signers[0].address);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();

    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     expect(await ethFrxEthLp.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance);

    // })

    // it.only("Deposit without LP tokens, withdraw half in non LP. Should have half deposit locked", async function () {
    //     const usdcBalance = await usdc.balanceOf(signers[0].address);
    //     await usdc.approve(exchange.address, usdcBalance);
    //     const lpBalance = await exchange.callStatic.exchange(usdc.address, ethFrxEthLp.address, usdcBalance, 0);
    //     console.log("LP balance before", lpBalance)
    //     console.log("USDC balance before", usdcBalance)
    //     await usdc.approve(AlluoVault.address, usdcBalance);
    //     await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
    //     await AlluoVault.stakeUnderlying();
    //     await AlluoVault.requestWithdrawal(lpBalance.div(2), signers[0].address);

    //     await skipDays(9);

    //     await AlluoVault.stakeUnderlying();
    //     await AlluoVault.withdrawToNonLp(lpBalance.div(2), signers[0].address, signers[0].address, usdc.address);

    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     expect(await usdc.balanceOf(signers[0].address)).to.be.gt(0);
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));

    // })

    // it.only("Deposit without LP tokens, withdraw half in non LP. Should have half deposit locked", async function () {
    //     const usdcBalance = await usdc.balanceOf(signers[0].address);
    //     await usdc.approve(exchange.address, usdcBalance);
    //     const lpBalance = await exchange.callStatic.exchange(usdc.address, ethFrxEthLp.address, usdcBalance, 0);
    //     console.log("LP balance before", lpBalance)
    //     console.log("USDC balance before", usdcBalance)
    //     await usdc.approve(AlluoVault.address, usdcBalance);
    //     await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
    //     await AlluoVault.stakeUnderlying();
    //     await AlluoVault.requestWithdrawal(lpBalance.div(2), signers[0].address);

    //     await skipDays(9);

    //     await AlluoVault.stakeUnderlying();
    //     await AlluoVault.withdrawToNonLp(lpBalance.div(2), signers[0].address, signers[0].address, usdc.address);

    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     expect(await usdc.balanceOf(signers[0].address)).to.be.gt(0);
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));

    // })

    // it.only("Deposit N, request withdrawal of N, deposit again N and withdraw N. Should keep remaining N locked", async function () {
    //     const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
    //     console.log("LP balance before", lpBalance)
    //     await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();
    //     await skipDays(8);
    //     expect(await AlluoVault.totalAssets()).to.be.eq(lpBalance.div(2));

    //     await AlluoVault.requestWithdrawal(lpBalance.div(2), signers[0].address);
    //     expect(await AlluoVault.totalAssets()).to.be.eq(lpBalance.div(2));

    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();
    //     expect(await AlluoVault.totalAssets()).to.be.eq(lpBalance.div(2));

    //     const amount = (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalAvailable;
    //     await AlluoVault.withdraw(amount, signers[0].address, signers[0].address);

    //     console.log('alluo balance of assets', await AlluoVault.totalAssets());
    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
    //     expect(await ethFrxEthLp.balanceOf(signers[0].address)).to.be.eq(amount);

    // })

    // it.only("Withdraw from the Vault in non LP", async function () {
    //     const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
    //     console.log("LP balance before", lpBalance)
    //     await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault["deposit(uint256)"](lpBalance);
    //     await AlluoVault.stakeUnderlying();
    //     console.log('locked balance 1', await AlluoVault.lockedBalance());
    //     await AlluoVault.requestWithdrawal(lpBalance.div(2), signers[0].address);
    //     await skipDays(8);
    //     await AlluoVault.stakeUnderlying();
    //     console.log('locked balance 2', await AlluoVault.lockedBalance());

    //     const amount = (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalAvailable;
    //     console.log('amount to withdraw', amount);
    //     const exitToken = usdc;
    //     const exitTokenBalanceBefore = await exitToken.balanceOf(signers[0].address);
    //     await AlluoVault.withdrawToNonLp(amount, signers[0].address, signers[0].address, exitToken.address);
    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);
    //     console.log('locked balance 3', await AlluoVault.lockedBalance());
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
    //     const exitTokenBalanceAfter = await exitToken.balanceOf(signers[0].address);
    //     expect(exitTokenBalanceAfter).to.be.gt(exitTokenBalanceBefore);

    // })

    // it.only("Deposit N tokens twice, request withdrawal of N before the end of cycle. Should revert withdrawal", async function () {
    //     const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
    //     console.log("LP balance before", lpBalance)
    //     await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await AlluoVault.stakeUnderlying();
    //     await skipDays(3);

    //     await AlluoVault.requestWithdrawal(lpBalance.div(2), signers[0].address);
    //     await AlluoVault["deposit(uint256)"](lpBalance.div(2));
    //     await skipDays(7);
    //     expect(AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address)).to.be.revertedWith("AlluoVault: withdraw over balance");

    //     expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.gt(0);
    //     expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));

    // })

    it("Deposit some Lp for vault tokens and then burn them for the same LPs back.", async function () {
        const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
        console.log('balance', lpBalance);
        await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);

        await AlluoVault.stakeUnderlying();
        await skipDays(1);
        await alluoPool.connect(admin).farm();
        await skipDays(1);
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

        await AlluoVault.withdraw(lpBalance, signers[0].address, signers[0].address);
        await AlluoVault.claimRewards();

        expect(await AlluoVault.balanceOf(signers[0].address)).equal(0)
        // this must be greater than or equal because the base pool APY is quite high.
        console.log('LP tokens after withdrawal', await ethFrxEthLp.balanceOf(signers[0].address));
        expect(Number(await ethFrxEthLp.balanceOf(signers[0].address))).greaterThanOrEqual(Number(lpBalance))
        console.log("Rewards in LP", Number(await rewardToken.balanceOf(signers[0].address)));
        expect(Number(await rewardToken.balanceOf(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault.totalAssets())).equal(0)
        expect(Number(await AlluoVault.totalSupply())).equal(0)
    })

    it("After looping rewards, expect fundsLocked to increase.", async function () {

        const lpBalance = await ethFrxEthLp.balanceOf(signers[0].address);
        await ethFrxEthLp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.1);
        await alluoPool.connect(admin).farm();

        const initialRewards = await alluoPool.fundsLocked();
        console.log('LPs staked before', initialRewards);

        await skipDays(10);
        await alluoPool.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(alluoPool.address);
        const cvxAccumulated = await cvx.balanceOf(alluoPool.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)

        await alluoPool.connect(admin).farm();

        const compoundedRewards = await alluoPool.fundsLocked();
        console.log("LPs staked after", compoundedRewards);
        expect(Number(compoundedRewards)).greaterThan(Number(initialRewards));
    })

    it("Deposit frax to enter pool.", async function () {

        const fraxBalance = parseEther("100");
        await frax.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(fraxBalance, frax.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(1);
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
    })

    it("Deposit usdc to enter pool.", async function () {
        const usdcBalance = await usdc.balanceOf(signers[0].address);
        await usdc.approve(AlluoVault.address, usdcBalance);

        const crvBefore = await crv.balanceOf(AlluoVault.address);
        const cvxBefore = await cvx.balanceOf(AlluoVault.address);

        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        expect(usdcBalance).to.be.gt(await usdc.balanceOf(signers[0].address));
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        expect(Number(crvAccumulated)).greaterThan(Number(crvBefore));
        expect(Number(cvxAccumulated)).greaterThan(Number(cvxBefore));
    })

    it("Deposit usdt to enter pool (non pool token).", async function () {

        const usdtBalance = parseUnits("100", 6);
        const crvBefore = await crv.balanceOf(AlluoVault.address);
        const cvxBefore = await cvx.balanceOf(AlluoVault.address);
        await usdt.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdtBalance, usdt.address);
        expect(await usdt.balanceOf(signers[0].address)).to.be.gt(usdtBalance);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        expect(Number(crvAccumulated)).greaterThan(Number(crvBefore));
        expect(Number(cvxAccumulated)).greaterThan(Number(cvxBefore));
    })

    it("Deposit usdc to enter pool and exit again in USDC", async function () {

        const usdcBalance = parseUnits("100", 6);
        await usdc.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        expect(await usdc.balanceOf(signers[0].address)).to.be.gt(usdcBalance);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();

        const lpBalance = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.withdrawToNonLp(lpBalance, signers[0].address, signers[0].address, usdc.address)
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(0);

    })

    it("Deposit usdt to enter pool (non pool token) and exit again in a non pool token.", async function () {
        const usdtBalance = parseUnits("100", 6);
        await usdt.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdtBalance, usdt.address);
        const usdtBefore = await usdt.balanceOf(signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        const lpBalance = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.withdrawToNonLp(lpBalance, signers[0].address, signers[0].address, usdt.address)
        expect(await usdt.balanceOf(signers[0].address)).to.be.gt(usdtBefore);

    })

    it("Multiple deposits and withdrawals should return correct LP amounts", async function () {
        let signerBalancesBefore = []
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, ethFrxEthLp.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await ethFrxEthLp.balanceOf(signers[i].address)
            await ethFrxEthLp.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
            signerBalancesBefore.push(await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        for (let i = 1; i < 6; i++) {
            let signerBalance = await AlluoVault.balanceOf(signers[i].address)
            await AlluoVault.connect(signers[i]).withdraw(signerBalance, signers[i].address, signers[i].address);
            expect(Number(await AlluoVault.balanceOf(signers[i].address))).equal(0);
        }

        for (let i = 0; i < 5; i++) {
            expect(Number(signerBalancesBefore[i])).equal(Number(await ethFrxEthLp.balanceOf(signers[i + 1].address)))
        }
    })
    it("Multiple deposits should return correct LP amounts and reward distribution (equal here)", async function () {
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, ethFrxEthLp.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = parseEther("100")
            await ethFrxEthLp.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.connect(admin).farm();

        await skipDays(10);
        await AlluoVault.connect(signers[1]).claimRewards();
        let expectBalance = await rewardToken.balanceOf(signers[1].address)

        for (let i = 2; i < 6; i++) {
            await AlluoVault.connect(signers[xi]).claimRewards();
            // Small dust
            expect(Number(await rewardToken.balanceOf(signers[i].address)).toPrecision(2)).equal(Number(expectBalance).toPrecision(2))
            console.log(`Reward tokens for signer ${i}: ${await rewardToken.balanceOf(signers[i].address)}`)
        }
    })


    it("Multiple deposits and withdrawals in nonLP tokens should return correct LP amounts and reward distribution (equal here)", async function () {
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, frax.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            const fraxBalance = parseEther("100");
            await frax.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(fraxBalance, frax.address);

            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.connect(admin).farm();

        await skipDays(10);
        await AlluoVault.connect(signers[1]).claimRewards();
        await AlluoVault.connect(signers[1]).withdrawToNonLp(await AlluoVault.balanceOf(signers[1].address), signers[1].address, signers[1].address, frax.address);
        expect(await AlluoVault.balanceOf(signers[1].address)).equal(0);

        let expectBalance = await rewardToken.balanceOf(signers[1].address)
        for (let i = 2; i < 6; i++) {
            await AlluoVault.connect(signers[i]).claimRewards();
            await AlluoVault.connect(signers[i]).withdrawToNonLp(await AlluoVault.balanceOf(signers[i].address), signers[i].address, signers[i].address, frax.address);
            // Small dust
            expect(Number(await rewardToken.balanceOf(signers[i].address)).toPrecision(2)).equal(Number(expectBalance).toPrecision(2))
            expect(await AlluoVault.balanceOf(signers[i].address)).equal(0);
            console.log(`Reward tokens for signer ${i}: ${await rewardToken.balanceOf(signers[i].address)}`)
        }
        expect(await AlluoVault.totalSupply()).equal(await AlluoVault.totalAssets());

    })

    it("After some loops, the multisig should be able to claim fees accumulated.", async function () {
        await AlluoVault.setAdminFee(100);
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, ethFrxEthLp.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await ethFrxEthLp.balanceOf(signers[i].address)
            await ethFrxEthLp.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.connect(admin).farm();

        await skipDays(10);
        await AlluoVault.connect(signers[1]).claimRewards();
        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"
        expect(Number(await AlluoVault.earned(gnosis))).greaterThan(0);
    })
});

