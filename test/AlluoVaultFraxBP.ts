import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { afterEach, before } from "mocha";
import { Exchange, IERC20MetadataUpgradeable, AlluoConvexVaultNative, IFraxFarmERC20, IConvexWrapper, AlluoVaultPool } from "../typechain";


async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

function makeEvenNumber(n: BigNumber) {
    if (n.div(2).mul(2) != n) {
        return n.sub(1)
    } else return ethers.BigNumber.from(n);
}

describe("FraxConvex Alluo Vault Upgradeable Tests", function () {

    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable,
        crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable,
        rewardToken: IERC20MetadataUpgradeable, cvxCrvFraxBPlp: IERC20MetadataUpgradeable, fxs: IERC20MetadataUpgradeable,
        stakingToken: IConvexWrapper;
    let exchange: Exchange;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault: AlluoConvexVaultNative;
    let alluoPool: AlluoVaultPool;
    let cvxCrvFraxBPPool: IFraxFarmERC20;
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
        console.log('\n', "||| Confirm that the _grantRoles(.., msg.sender) in AlluoConvexVaultNative.sol has been uncommented to ensure tests are functioning correctly |||", '\n')

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
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        cvxCrvFraxBPlp = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x527331f3f550f6f85acfecab9cc0889180c6f1d5");
        cvxCrvFraxBPPool = await ethers.getContractAt("IFraxFarmERC20", "0x57c9F019B25AaAF822926f4Cacf0a860f61eDd8D");
        fxs = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0");
        stakingToken = await ethers.getContractAt("IConvexWrapper", "0xa103a6ca0C4D4072BA59a55FD453BFE4197A095B");
        admin = await getImpersonatedSigner("0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3");

        const value = parseEther("2000.0");

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
            ZERO_ADDR, cvxCrvFraxBPlp.address, value, 0, { value: value }
        )

        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3";
        let AlluoConvexVaultNative = await ethers.getContractFactory("AlluoConvexVaultNative")
        AlluoVault = await upgrades.deployProxy(AlluoConvexVaultNative, [
            "cvxCrv-FraxBP Vault",
            "cvxCrv-FraxBP",
            cvxCrvFraxBPlp.address, // underlying token
            rewardToken.address, // Curve CVX-ETH Convex Deposit (cvxcrvCVX...)
            ZERO_ADDR, // set pool later
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693", // trusted wallet for meta transactions
            [crv.address, cvx.address, fxs.address], // yield tokens
            cvxCrvFraxBPPool.address
        ], {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoConvexVaultNative;

        // let PoolVaultFactory = await ethers.getContractFactory("AlluoVaultPool");
        // alluoPool = await upgrades.deployProxy(PoolVaultFactory, [
        //     rewardToken.address,
        //     gnosis,
        //     [crv.address, cvx.address],
        //     [AlluoVault.address],
        //     "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address
        //     64, //Pool number convex
        //     cvx.address
        // ]) as AlluoVaultPool;

        alluoPool = await ethers.getContractAt("AlluoVaultPool", "0x470e486acA0e215C925ddcc3A9D446735AabB714");
        await alluoPool.connect(admin).editVault(true, AlluoVault.address);

        await AlluoVault.setPool(alluoPool.address);
        await AlluoVault.grantRole(await AlluoVault.DEFAULT_ADMIN_ROLE(), alluoPool.address)

    });

    afterEach(async () => {
        expect(await AlluoVault.totalSupply()).equal(await AlluoVault.totalAssets());
    });

    it("Deposit some LP and wait for Vault rewards to accumulate", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        console.log("LP balance before", lpBalance)
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        expect(await cvxCrvFraxBPlp.balanceOf(AlluoVault.address)).to.be.eq(lpBalance);
        await AlluoVault.stakeUnderlying();
        expect(await cvxCrvFraxBPlp.balanceOf(AlluoVault.address)).to.be.eq(0);
        expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);
        await AlluoVault.loopRewards();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance);
        await skipDays(10);
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        const fxsAccumulated = await fxs.balanceOf(AlluoVault.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        console.log(fxsAccumulated)
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
        expect(Number(fxsAccumulated)).greaterThan(0)

    });

    it("Deposit some LP, claim rewards after farming", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        const rewardsBefore = await usdc.balanceOf(signers[0].address);
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await alluoPool.connect(admin).farm();
        await skipDays(10);
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));
        await AlluoVault.claimRewards(usdc.address);
        const rewardsAfter = await usdc.balanceOf(signers[0].address);
        expect(rewardsAfter).to.be.gt(rewardsBefore);
        console.log('Rewards before:', rewardsBefore, 'rewards after:', rewardsAfter);
    })

    it("Deposit non LP tokens", async function () {

        const usdcBalance = await usdc.balanceOf(signers[0].address);
        expect(Number(usdcBalance) > 0);
        await usdc.approve(AlluoVault.address, usdcBalance);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.gt(0);

    })

    it("Claim half of deposited amount", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance);
        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(lpBalance);
        await skipDays(8);
        await AlluoVault.loopRewards();

        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(lpBalance.sub(lpBalance.div(2)));
        expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(lpBalance.div(2));
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));

        const exitTokenBefore = await usdt.balanceOf(signers[0].address);
        await AlluoVault.claim(usdt.address, signers[0].address);
        expect(await usdt.balanceOf(signers[0].address)).to.be.gt(exitTokenBefore);

    })

    it("Redeem half of deposited amount", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));

        await AlluoVault.redeem(lpBalance.div(2), signers[0].address, signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);

        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(lpBalance);
        await skipDays(8);
        await AlluoVault.loopRewards();
        console.log("Withdrawal queue length", AlluoVault.withdrawalqueue.length);

        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(lpBalance.div(2));
        expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(lpBalance.div(2));
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);

        const exitTokenBefore = await usdt.balanceOf(signers[0].address);
        await AlluoVault.claim(usdt.address, signers[0].address);
        expect(await usdt.balanceOf(signers[0].address)).to.be.gt(exitTokenBefore);

    })

    it("Should redeem on behalf of someone else", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(8);
        const ownerBalanceBefore = await frax.balanceOf(signers[0].address);
        await AlluoVault.increaseAllowance(signers[1].address, lpBalance.div(2));
        await AlluoVault.connect(signers[1]).redeem(lpBalance.div(2), signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.connect(signers[1]).claim(frax.address, signers[0].address);
        expect(await frax.balanceOf(signers[0].address)).to.be.gt(ownerBalanceBefore);
    })

    it("Should withdraw on behalf of someone else", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(8);
        const ownerBalanceBefore = await frax.balanceOf(signers[0].address);
        await AlluoVault.increaseAllowance(signers[1].address, lpBalance.div(2));
        await AlluoVault.connect(signers[1]).withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.connect(signers[1]).claim(frax.address, signers[0].address);
        expect(await frax.balanceOf(signers[0].address)).to.be.gt(ownerBalanceBefore);
    })

    it("Should revert withdrawal over the balance of the owner", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(8);
        await AlluoVault.withdraw(lpBalance.div(4), signers[0].address, signers[0].address);
        await expect(AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address)).to.be.reverted;
    })

    it("Should increase withdrawal amount", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(8);
        const ownerBalanceBefore = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await AlluoVault.withdraw(lpBalance.div(4), signers[0].address, signers[0].address);
        await AlluoVault.withdraw(lpBalance.div(4), signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.connect(signers[1]).claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(await cvxCrvFraxBPlp.balanceOf(signers[0].address)).to.be.eq(ownerBalanceBefore.add(lpBalance.div(2)));
    })

    it("Should claim withdrawal in Lps", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(8);
        const signerBalance = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.withdraw(signerBalance, signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address))).to.be.eq(lpBalance);
    })

    it("Should claim rewards in non Lps", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying(); // locks funds
        await skipDays(8);
        await alluoPool.connect(admin).farm();
        const rewardsBefore = await frax.balanceOf(signers[0].address);
        await AlluoVault.claimRewards(frax.address);
        const rewardsAfter = await frax.balanceOf(signers[0].address);
        expect(rewardsAfter).to.be.gt(rewardsBefore);
    })

    it("Should not satisfy an early claim", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying(); // locks funds
        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await skipDays(8);
        const rewardBalanceBefore = await usdt.balanceOf(signers[0].address);
        await AlluoVault.claim(usdt.address, signers[0].address);
        expect(await usdt.balanceOf(signers[0].address)).to.be.eq(rewardBalanceBefore)

    })

    it("Should keep all funds for withdrawals and try stakeUnderlying again", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await skipDays(8);
        await alluoPool.connect(admin).farm();
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);

    })

    it("Check if second staking is to the same kek id", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await AlluoVault.deposit(lpBalance.sub(lpBalance.div(2)), signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(1);
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance);

    })

    it("Deposit N tokens twice, do one cycle and request withdrawal of N/2. Should have N/2 locked and N/2 available for withdrawal", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        console.log("LP balance before", lpBalance)
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
        await skipDays(8);

        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying(); // stakes new deposits
        await AlluoVault.loopRewards(); // satifsfy withdrawals

        expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(lpBalance.div(2));
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));

    })

    it("Multiple deposits and withdrawals should return correct LP amounts", async function () {
        let signerBalancesBefore = []
        let signerExitTokenBefore = []
        const exitToken = usdc;
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, cvxCrvFraxBPlp.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[i].address));
            await cvxCrvFraxBPlp.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            signerBalancesBefore.push(await AlluoVault.balanceOf(signers[i].address));
            signerExitTokenBefore.push(await exitToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        for (let i = 1; i < 4; i++) {
            let signerBalance = await AlluoVault.balanceOf(signers[i].address)
            await AlluoVault.connect(signers[i]).withdraw(signerBalance, signers[i].address, signers[i].address);
        }

        await skipDays(10);
        await alluoPool.connect(admin).farm();
        await skipDays(10);

        for (let i = 1; i < 4; i++) {
            await AlluoVault.connect(signers[i]).claim(exitToken.address, signers[i].address);
            expect(signerExitTokenBefore[i - 1]).to.be.lt(await exitToken.balanceOf(signers[i].address));
        }

        for (let i = 4; i < 6; i++) {
            expect(await AlluoVault.balanceOf(signers[i].address)).to.be.eq(signerBalancesBefore[i - 1]);
        }
    })

    it("Multiple deposits and withdrawals should return correct rewards", async function () {
        let signerRewardTokenBefore = []
        const exitToken = usdc;
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(lpBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        for (let i = 1; i < 4; i++) {
            let signerBalance = await AlluoVault.balanceOf(signers[i].address)
            await AlluoVault.connect(signers[i]).withdraw(signerBalance, signers[i].address, signers[i].address);
        }
        await alluoPool.connect(admin).farm();

        for (let i = 1; i < 4; i++) {
            await AlluoVault.connect(signers[i]).claimRewards(rewardToken.address);
            expect(await rewardToken.balanceOf(signers[i].address)).to.be.gt(signerRewardTokenBefore[i - 1]);
            console.log(`Reward balance of signer ${i} is ${await rewardToken.balanceOf(signers[i].address)}`);
        }
    })

    it("Rewards should stop accumulating after withdrawal request and after funds are unlocked", async function () {
        let signerRewardTokenBefore = [];
        for (let i = 0; i < 3; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let usdcBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(usdcBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);

        await AlluoVault.withdraw(await AlluoVault.balanceOf(signers[0].address), signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        const rewardsBefore = await rewardToken.balanceOf(signers[0].address);
        console.log(rewardsBefore);
        await AlluoVault.claimRewards(rewardToken.address);
        const rewardsAfter = await rewardToken.balanceOf(signers[0].address);
        expect(rewardsAfter).to.be.gt(rewardsBefore);
        await skipDays(10);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claimRewards(rewardToken.address);
        expect(await rewardToken.balanceOf(signers[0].address)).to.be.eq(rewardsAfter);

    })

    it("The new owner of vault shares should claim funds requested for withdrawal by previous owner", async function () {
        let signerRewardTokenBefore = [];
        for (let i = 0; i < 3; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(lpBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.withdraw(await AlluoVault.balanceOf(signers[0].address), signers[0].address, signers[0].address);

        const amount = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.transfer(signers[1].address, amount);
        const balanceBefore = await usdc.balanceOf(signers[1].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.connect(signers[1]).claim(usdc.address, signers[1].address);
        expect(await usdc.balanceOf(signers[1].address)).to.be.gt(balanceBefore);

    })

    it("The previous owner should not be eligible for funds after transferring vault shares", async function () {
        let signerRewardTokenBefore = [];
        for (let i = 0; i < 3; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(lpBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.withdraw(await AlluoVault.balanceOf(signers[0].address), signers[0].address, signers[0].address);
        const amount = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.transfer(signers[1].address, amount);
        const balanceBefore = await usdc.balanceOf(signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claim(usdc.address, signers[0].address);
        expect(await usdc.balanceOf(signers[0].address)).to.be.eq(balanceBefore);
    })

    it("The previous owner should not be eligible for rewards after transferring vault shares if deposit lasted for less then two weeks", async function () {
        let signerRewardTokenBefore = [];
        for (let i = 0; i < 3; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(lpBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(await AlluoVault.balanceOf(signers[0].address), signers[0].address, signers[0].address);
        await skipDays(8);

        const amount = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.transfer(signers[1].address, amount);
        const rewardsBefore = await usdc.balanceOf(signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claimRewards(usdc.address);
        expect(await usdc.balanceOf(signers[0].address)).to.be.eq(rewardsBefore);
    })

    it("The new owner should be eligible for rewards after the end of current cycle", async function () {
        let signerRewardTokenBefore = [];
        for (let i = 0; i < 3; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(lpBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(await AlluoVault.balanceOf(signers[0].address), signers[0].address, signers[0].address);
        await skipDays(8);

        const amount = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.transfer(signers[1].address, amount);
        const rewardsBefore = await usdc.balanceOf(signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claimRewards(usdc.address);
        expect(await usdc.balanceOf(signers[0].address)).to.be.eq(rewardsBefore);

    })

    it("The new owner's withdrwal request should be increased by the old owner's request", async function () {
        let signerRewardTokenBefore = [];
        for (let i = 0; i < 3; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(lpBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(await AlluoVault.balanceOf(signers[0].address), signers[0].address, signers[0].address);
        await AlluoVault.connect(signers[1]).withdraw(await AlluoVault.balanceOf(signers[1].address), signers[1].address, signers[1].address);
        await skipDays(8);

        const amount = await AlluoVault.balanceOf(signers[0].address);
        const sharesBefore = await AlluoVault.balanceOf(signers[1].address);
        await AlluoVault.transfer(signers[1].address, amount);
        const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[1].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[1].address);
        expect(await cvxCrvFraxBPlp.balanceOf(signers[1].address)).to.be.eq(balanceBefore.add(sharesBefore).add(amount));

    })

    it("Admin should unlock all funds from frax convex", async function () {

        const usdcBalance = await usdc.balanceOf(signers[0].address);
        expect(Number(usdcBalance) > 0);
        await usdc.approve(AlluoVault.address, usdcBalance);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        const balaceBefore = await AlluoVault.totalAssets();
        await AlluoVault.connect(admin).unlockFromFraxConvex();
        await AlluoVault.stakeUnderlying();
        await skipDays(9);
        await AlluoVault.connect(admin).unlockFromFraxConvex();
        expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.gte(balaceBefore);
    })

    it("After some loops, the multisig should be able to claim fees accumulated.", async function () {
        let signerRewardTokenBefore = []
        const exitToken = usdc;
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, usdc.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await usdc.balanceOf(signers[i].address);
            await usdc.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(lpBalance, usdc.address);
            signerRewardTokenBefore.push(await rewardToken.balanceOf(signers[i].address));
        }

        let multisigRewards = []
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await alluoPool.connect(admin).farm();
        multisigRewards.push()
        await skipDays(10);
        await alluoPool.connect(admin).farm();

        for (let i = 1; i < 4; i++) {
            await AlluoVault.connect(signers[i]).claimRewards(rewardToken.address);
            expect(await rewardToken.balanceOf(signers[i].address)).to.be.gt(signerRewardTokenBefore[i - 1]);
            console.log(`Reward balance of signer ${i} is ${await rewardToken.balanceOf(signers[i].address)}`);
        }
    })

    it("Shouldn't allow user to claim withdrawals from the transferred shares after they have been withdrawn", async () => {
        /// Deposit in nonLP tokens
        const usdcBalance = parseUnits("5000", 6);
        expect(Number(usdcBalance) > 0);
        await usdc.approve(AlluoVault.address, usdcBalance);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);

        let userShares = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10)
        await AlluoVault.withdraw(userShares, signers[0].address, signers[0].address)
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(1)

        console.log("Giannis balance", await AlluoVault.balanceOf(signers[0].address))
        console.log("Chris balance", await AlluoVault.balanceOf(signers[3].address))

        await AlluoVault.transfer(signers[3].address, userShares) // now withdrawals should be claimable by signer[3]
        const balanceBefore = await usdc.balanceOf(signers[0].address);
        await AlluoVault.claim(usdc.address, signers[0].address)
        expect(await usdc.balanceOf(signers[0].address)).to.be.eq(balanceBefore);
        console.log("\nChecked: old owner claimed the rewards")
        console.log("\nBalance of the old owner", await AlluoVault.balanceOf(signers[0].address))
        console.log("\nBalance of the new owner", await AlluoVault.balanceOf(signers[3].address))

        await exchange.connect(signers[4]).exchange(
            ZERO_ADDR, cvxCrvFraxBPlp.address, parseEther("10"), 0, { value: parseEther("10") }
        )
        await cvxCrvFraxBPlp.connect(signers[4]).approve(AlluoVault.address, await cvxCrvFraxBPlp.balanceOf(signers[4].address));
        await AlluoVault.connect(signers[4]).deposit(await cvxCrvFraxBPlp.balanceOf(signers[4].address), signers[4].address);

        const liquidityBeforeFarming = await cvxCrvFraxBPPool.lockedLiquidityOf(AlluoVault.address);
        await skipDays(10);
        await alluoPool.connect(admin).farm(); // should keep funds to satisfy unclaimed withdrawals
        // now vault has wrapped lps (withdrawal request) and unwrapped lps (new deposits)
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(1)
        expect(await cvxCrvFraxBPPool.lockedLiquidityOf(AlluoVault.address)).to.be.lt(liquidityBeforeFarming);

        const rewardsBefore = await rewardToken.balanceOf(signers[3].address);
        await AlluoVault.connect(signers[3]).claimRewards(rewardToken.address)
        expect(await rewardToken.balanceOf(signers[3].address)).to.be.gt(rewardsBefore); // should be eligible for rewards even if funds haven't been locked yet
        console.log("\nChecked: new owner got the rewards")
        await AlluoVault.stakeUnderlying() // should stake unwrapped lps (new deposits)
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(2)
        await skipDays(10);
        await alluoPool.connect(admin).farm();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(3)
        await AlluoVault.stakeUnderlying()
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(3)
        await skipDays(5);
        await alluoPool.connect(admin).farm();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(3)
        await skipDays(5);
        await alluoPool.connect(admin).farm();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(4)
        await AlluoVault.connect(signers[3]).claimRewards(usdc.address)
        expect(await cvxCrvFraxBPPool.lockedLiquidityOf(AlluoVault.address)).to.be.gt(0)
        console.log("\nChecked: locked liquidity is above zero")
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(4)
        console.log("\nChecked: kek ids are 4")
    })

    it("Should change locking duration", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.connect(admin).changeLockingDuration(1200600);
        await AlluoVault.stakeUnderlying();
        await AlluoVault.connect(admin).unlockFromFraxConvex();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
        await skipDays(14);
        await AlluoVault.connect(admin).unlockFromFraxConvex();
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);
    })

    it("Shouldn't allow user to withdraw extra funds by transferring shares", async () => {
        const usdcBalance = parseUnits("5000", 6)
        expect(Number(usdcBalance) > 0)
        await usdc.approve(AlluoVault.address, usdcBalance)
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address)

        let userShares = await AlluoVault.balanceOf(signers[0].address)
        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(userShares, signers[0].address, signers[0].address)
        await AlluoVault.transfer(signers[3].address, userShares)
        await AlluoVault.loopRewards()

        await skipDays(10)
        // Balance of shares of the user to whom they were transferred
        console.log("Shares balance of the user", await AlluoVault.balanceOf(signers[3].address))

        await AlluoVault.claim(usdc.address, signers[0].address)
        await alluoPool.connect(admin).farm()

        await usdc.connect(signers[3]).approve(AlluoVault.address, await usdc.balanceOf(signers[3].address))
        expect(await AlluoVault.balanceOf(signers[3].address)).to.eq(0)
        console.log("Shares balance of the user after the claim", await AlluoVault.balanceOf(signers[3].address))
    })

    it("Should mint shares and allow to withdraw", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.mint(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(lpBalance.div(2));
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
        await skipDays(14);
        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address))).to.be.eq(lpBalance);
    })

    it("Should have 5 kek_ids after 5 full withdrawals", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        for (let i = 0; i < 6; i++) {
            await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
            await AlluoVault.stakeUnderlying();
            await skipDays(10);
            const signerBalance = await AlluoVault.balanceOf(signers[0].address);
            await AlluoVault.withdraw(signerBalance, signers[0].address, signers[0].address);

            console.log(`Total assets in cycle ${i + 1} before withdrawal`, await AlluoVault.totalAssets());
            console.log(`\nTotal supply in cycle ${i + 1} before withdrawal`, await AlluoVault.totalSupply());

            await AlluoVault.stakeUnderlying();
            await alluoPool.connect(admin).farm();
            await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
            console.log(`Total assets in cycle ${i + 1} after withdrawal`, await AlluoVault.totalAssets());
            expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(i + 1);
            console.log(`\nChecked: after ${i + 1} full withdrdawals llockedStakesOfLength() is ${i + 1}`)
        }
    })

    it("Should not lock funds when calling farm() before stakeUnderlying()", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await alluoPool.connect(admin).farm();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(0);
        await AlluoVault.stakeUnderlying();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(1);
    })

    it("Should track assets correctly", async () => {
        /// Deposit in nonLP tokens
        const usdcBalance = await usdc.balanceOf(signers[0].address);
        expect(Number(usdcBalance) > 0);
        await usdc.approve(AlluoVault.address, usdcBalance);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);

        let userShares = await AlluoVault.balanceOf(signers[0].address);

        expect(Number(userShares)).to.be.gt(0);
        expect(await AlluoVault.totalAssets()).to.eq(userShares);
        expect(await AlluoVault.stakedBalance()).to.eq(0)
        expect(await AlluoVault.lockedBalance()).to.eq(0)

        //Staking
        await AlluoVault.stakeUnderlying();

        expect(Number(userShares)).to.be.gt(0);
        expect(await AlluoVault.totalAssets()).to.eq(userShares);
        expect(await AlluoVault.stakedBalance()).to.eq(0)
        expect(await AlluoVault.lockedBalance()).to.eq(userShares)

        await AlluoVault.withdraw(userShares.div(2), signers[0].address, signers[0].address);

        await skipDays(10)
        await AlluoVault.loopRewards()
        expect(await AlluoVault.totalAssets()).to.eq(userShares.div(2))
        await AlluoVault.claim(usdc.address, signers[0].address)
    })
});

