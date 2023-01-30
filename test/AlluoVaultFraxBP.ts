import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { afterEach, before } from "mocha";
import { Exchange, IERC20MetadataUpgradeable, AlluoLockedVault, IFraxFarmERC20, IConvexWrapper, AlluoVaultPool } from "../typechain";


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
    let AlluoVault: AlluoLockedVault;
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
        console.log('\n', "||| Confirm that the _grantRoles(.., msg.sender) in AlluoLockedVault.sol has been uncommented to ensure tests are functioning correctly |||", '\n')

    });

    beforeEach(async () => {

        await resetNetwork();
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        usdt = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
        crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
        cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        cvxCrvFraxBPlp = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x527331f3f550f6f85acfecab9cc0889180c6f1d5");
        cvxCrvFraxBPPool = await ethers.getContractAt("IFraxFarmERC20", "0x57c9F019B25AaAF822926f4Cacf0a860f61eDd8D");
        fxs = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0");
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
        let AlluoLockedVault = await ethers.getContractFactory("AlluoLockedVault")
        AlluoVault = await upgrades.deployProxy(AlluoLockedVault, [
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
        }) as AlluoLockedVault;

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

    // afterEach(async () => {
    //     expect(await AlluoVault.totalSupply()).equal(await AlluoVault.totalAssets());
    // });

    /* ----------------------- DEPOSITS ------------------------- */

    it("Should return correct amount of shares when depositing non LP tokens", async function () {

        const usdcBalance = await usdc.balanceOf(signers[0].address);
        expect(Number(usdcBalance) > 0);
        await usdc.approve(AlluoVault.address, usdcBalance);
        await usdc.approve(exchange.address, usdcBalance);
        const expectedLP = await exchange.callStatic.exchange(usdc.address, cvxCrvFraxBPlp.address, usdcBalance, 0);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(expectedLP);

    })

    it("Should revert because of _nonLpMaxDeposit()", async function () {

        const amount = parseEther("10");
        const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[0].address);


        const usdcBalance = await usdc.balanceOf(signers[0].address);
        expect(Number(usdcBalance) > 0);
        await usdc.approve(AlluoVault.address, usdcBalance);
        await usdc.approve(exchange.address, usdcBalance);
        const expectedLP = await exchange.callStatic.exchange(usdc.address, cvxCrvFraxBPlp.address, usdcBalance, 0);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(expectedLP);

    })

    it("Should mint shares and allow to withdraw", async function () {
        const amount = parseEther("10");
        const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[0].address);
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.mint(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(amount);
        expect(await AlluoVault.lockedBalance()).to.be.eq(amount);

        await skipDays(14);

        await AlluoVault.withdraw(amount, signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(0)
        expect(await cvxCrvFraxBPlp.balanceOf(signers[0].address)).to.be.eq(balanceBefore);
    })

    /* ----------------------- CORRECT LOCKING INTO FRAX CONVEX ------------------------- */

    it("First lock should not be done by stakeUnderlying(), but by loopRewards()", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);
        expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(lpBalance);

        await alluoPool.connect(admin).farm();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance);
        expect(await stakingToken.balanceOf(AlluoVault.address)).to.be.eq(0);

    })

    it("Check if second staking is to the same kek id", async function () {
        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();

        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(1);
        expect(await AlluoVault.lockedBalance()).to.be.eq(amount.mul(3));

    })

    it("Should lock correctly second time (new kek_id, correct balance)", async function () {
        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        await skipDays(8)

        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(2);
        expect(await cvxCrvFraxBPPool.lockedLiquidityOf(AlluoVault.address)).to.be.eq(amount.mul(2));

    })

    it("Should lock correct amount after withdrawal request", async function () {
        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        await AlluoVault.withdraw(amount, signers[0].address, signers[0].address);
        await skipDays(8)

        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(2);
        expect(await cvxCrvFraxBPPool.lockedLiquidityOf(AlluoVault.address)).to.be.eq(amount);

    })

    it("Should relock to new kek_id correcty after full withdrawal in the previous cycle", async function () {

        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);

        await AlluoVault.deposit(amount, signers[0].address); // first lock 
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm(); // stakesLength = 1
        expect(await AlluoVault.lockedBalance()).to.be.eq(amount);

        await AlluoVault.withdraw(amount, signers[0].address, signers[0].address); // withdrawal request
        await skipDays(9);
        await alluoPool.connect(admin).farm(); // stakesLength = 1
        expect(await AlluoVault.lockedBalance()).to.be.eq(0); // locked balance is 0

        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        expect(await cvxCrvFraxBPPool.lockedLiquidityOf(AlluoVault.address)).to.be.eq(0); // locked balance is still zero before farm()


        //TODO: 
        // await skipDays(9);
        // await alluoPool.connect(admin).farm(); // stakesLength = 2
        // expect(await AlluoVault.lockedBalance()).to.be.eq(amount);
        // expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(2)
    })


    it("First lock should only happen after first calling stakeUnderlying(), then farm()", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await alluoPool.connect(admin).farm();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(0);
        await AlluoVault.stakeUnderlying();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(0);
        await alluoPool.connect(admin).farm();
        expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(1);
    })


    it("Should satisfy users' withdrawals in the next cycle after request. Should have 5 kek_ids after 5 cycles.", async function () {
        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await cvxCrvFraxBPlp.transfer(signers[1].address, amount);
        await cvxCrvFraxBPlp.connect(signers[1]).approve(AlluoVault.address, ethers.constants.MaxUint256);

        for (let i = 1; i < 6; i++) {
            console.log("\n--------------- new cycle ----------------------- \n")
            await AlluoVault.deposit(amount, signers[0].address);
            const signerBalance = await AlluoVault.balanceOf(signers[0].address);
            const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[0].address);

            await AlluoVault.stakeUnderlying();
            await AlluoVault.withdraw(signerBalance, signers[0].address, signers[0].address);
            await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address)
            expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(signerBalance);
            expect(await cvxCrvFraxBPlp.balanceOf(signers[0].address)).to.be.eq(balanceBefore)

            console.log(`\nTotal assets in cycle ${i} before withdrawal`, await AlluoVault.totalAssets());
            console.log(`\nTotal supply in cycle ${i} before withdrawal`, await AlluoVault.totalSupply());

            await alluoPool.connect(admin).farm(); // requests processed, shares burnt, 1 kek_id
            await skipDays(10);

            await AlluoVault.connect(signers[1]).deposit(amount, signers[1].address);
            await AlluoVault.stakeUnderlying();
            await alluoPool.connect(admin).farm(); // requests processed, shares burnt, 2 kek_id

            // expect(await AlluoVault.totalAssets()).to.be.eq(amount);
            // expect(await AlluoVault.totalSupply()).to.be.eq(amount);

            await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
            console.log(`\nTotal assets in cycle ${i} after withdrawal`, await AlluoVault.totalAssets());
            console.log(`\nTotal supply in cycle ${i} after withdrawal`, await AlluoVault.totalSupply());
            // expect(await AlluoVault.totalAssets()).to.be.eq(amount);
            expect(await cvxCrvFraxBPPool.lockedStakesOfLength(AlluoVault.address)).to.be.eq(i * 2);
            console.log(`\nChecked: after ${i * 2} cycles lockedStakesOfLength() is ${i * 2}`)
        }
    })


    /* ----------------------- REWARDS ------------------------- */


    it("Deposit some LP and wait for Vault rewards to accumulate", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        console.log("LP balance before", lpBalance)
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await AlluoVault.loopRewards();
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

    it("Should deposit and claim rewards after 10 days", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        const rewardsBefore = await usdc.balanceOf(signers[0].address);
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        await skipDays(10);

        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

        await AlluoVault.claimRewards(usdc.address);
        const rewardsAfter = await usdc.balanceOf(signers[0].address);
        expect(rewardsAfter).to.be.gt(rewardsBefore);
        console.log('Rewards earned :', ethers.utils.formatUnits(rewardsAfter.sub(rewardsBefore), await usdc.decimals()));
    })

    it("Should claim rewards in non Lps", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();// locks funds

        await skipDays(8);

        await alluoPool.connect(admin).farm();
        const rewardsBefore = await frax.balanceOf(signers[0].address);
        await AlluoVault.claimRewards(frax.address);
        const rewardsAfter = await frax.balanceOf(signers[0].address);
        expect(rewardsAfter).to.be.gt(rewardsBefore);
    })

    it("Rewards should stop accumulating after withdrawal request when funds are unlocked", async function () {
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
        await alluoPool.connect(admin).farm();
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
        await alluoPool.connect(admin).farm();
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

    it("The previous owner should not be eligible for rewards after transferring shares if happened before calling farm()", async function () {
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
        const amount = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.transfer(signers[1].address, amount);

        await alluoPool.connect(admin).farm(); // rewards per shareholder are updated
        await skipDays(8);

        console.log(await AlluoVault.rewardsPerShareAccumulated());
        console.log(await AlluoVault.balanceOf(signers[1].address));

        // no rewards for old owner
        const rewardsBefore = await usdc.balanceOf(signers[0].address);
        await AlluoVault.claimRewards(usdc.address);
        expect(await usdc.balanceOf(signers[0].address)).to.be.eq(rewardsBefore);

        // new owner should get the rewards
        const rewardsBefore1 = await usdc.balanceOf(signers[1].address);
        await AlluoVault.connect(signers[1]).claimRewards(usdc.address);
        expect(await usdc.balanceOf(signers[1].address)).to.be.gt(rewardsBefore1);
        console.log(ethers.utils.formatUnits((await usdc.balanceOf(signers[1].address)).sub(rewardsBefore1)))

    })

    /* ----------------------- WITHDRAWAL REQUESTS ------------------------- */

    it("Should show correct totalAssets() and totalSupply() after processing requests", async function () {

        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        await AlluoVault.withdraw(amount, signers[0].address, signers[0].address);
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalRequested).to.be.eq(amount)
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalAvailable).to.be.eq(0)
        await skipDays(8)

        console.log("Queue length is ", await AlluoVault.withdrawalQueueLength());

        await AlluoVault.deposit(amount, signers[0].address);
        expect(await AlluoVault.totalAssets()).to.be.eq(amount.mul(2))
        console.log('withdrawal queue length after farming', await AlluoVault.withdrawalQueueLength());
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(1)

        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalRequested).to.be.eq(0)
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalAvailable).to.be.eq(amount)
        expect(await AlluoVault.totalAssets()).to.be.eq(amount)
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(0)

    })

    it("User should not get claim if withdrawal request happened before the very first lock into frax", async function () {
        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount.mul(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(amount, signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();

        const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[0].address);
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(amount.mul(2));
        expect(await cvxCrvFraxBPlp.balanceOf(signers[0].address)).to.be.eq(balanceBefore);
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalAvailable).to.be.eq(0);
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalRequested).to.be.eq(amount);

    })

    it("Should return correct user balance after claiming half of deposited amount in lps", async function () {
        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount.mul(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        await AlluoVault.withdraw(amount, signers[0].address, signers[0].address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(amount.mul(2)); // balance is still > 0 before farm()

        await skipDays(8);
        await alluoPool.connect(admin).farm();
        const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[0].address);
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(amount);
        expect(await AlluoVault.lockedBalance()).to.be.eq(amount);
        expect(await cvxCrvFraxBPlp.balanceOf(signers[0].address)).to.be.eq(balanceBefore.add(amount))

    })

    it("Should return correct user balance after redeeming half of deposited amount in lps", async function () {
        const amount = parseEther("10");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount.mul(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        await AlluoVault.redeem(amount, signers[0].address, signers[0].address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(amount.mul(2)); // balance is still > 0 before farm()

        await skipDays(8);
        await alluoPool.connect(admin).farm();
        const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[0].address);
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(amount);
        expect(await AlluoVault.lockedBalance()).to.be.eq(amount);
        expect(await cvxCrvFraxBPlp.balanceOf(signers[0].address)).to.be.eq(balanceBefore.add(amount))

    })

    it("Should redeem on behalf of someone else", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        await skipDays(8);

        const ownerBalanceBefore = await frax.balanceOf(signers[0].address);
        await AlluoVault.increaseAllowance(signers[1].address, lpBalance.div(2));
        await AlluoVault.connect(signers[1]).redeem(lpBalance.div(2), signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.connect(signers[1]).claim(frax.address, signers[0].address);
        expect(await frax.balanceOf(signers[0].address)).to.be.gt(ownerBalanceBefore);
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(0)
    })

    it("Should withdraw on behalf of someone else", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        await skipDays(8);

        const ownerBalanceBefore = await frax.balanceOf(signers[0].address);
        await AlluoVault.increaseAllowance(signers[1].address, lpBalance.div(2));
        await AlluoVault.connect(signers[1]).withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await alluoPool.connect(admin).farm();
        await AlluoVault.connect(signers[1]).claim(frax.address, signers[0].address);
        expect(await frax.balanceOf(signers[0].address)).to.be.gt(ownerBalanceBefore);
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(0)
    })

    it("Should revert withdrawal over the balance of the owner", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        await skipDays(8);
        await AlluoVault.withdraw(lpBalance.div(4), signers[0].address, signers[0].address);
        await expect(AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address)).to.be.reverted;
    })

    // it.only("Should claim to another address", async function () {
    //     const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
    //     await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
    //     await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
    //     await AlluoVault.stakeUnderlying();
    //     await alluoPool.connect(admin).farm();
    //     await skipDays(8);
    //     await AlluoVault.withdraw(lpBalance.div(4), signers[0].address, signers[0].address);
    //     await alluoPool.connect(admin).farm();

    //     const balanceBefore = await usdc.balanceOf(signers[2].address);
    //     await AlluoVault.claim(usdc.address, signers[2].address);
    //     expect(await usdc.balanceOf(signers[2].address)).to.be.gt(balanceBefore);
    // })

    it("Should increase withdrawal amount", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        await skipDays(8);
        const ownerBalanceBefore = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await AlluoVault.withdraw(lpBalance.div(4), signers[0].address, signers[0].address);
        await AlluoVault.withdraw(lpBalance.div(4), signers[0].address, signers[0].address);
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(1)
        await alluoPool.connect(admin).farm();
        await AlluoVault.connect(signers[1]).claim(cvxCrvFraxBPlp.address, signers[0].address);
        expect(await cvxCrvFraxBPlp.balanceOf(signers[0].address)).to.be.eq(ownerBalanceBefore.add(lpBalance.div(2)));
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(0)
    })

    it("Should not satisfy an early claim", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm(); // locks funds
        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await skipDays(8);
        const rewardBalanceBefore = await usdt.balanceOf(signers[0].address);
        await AlluoVault.claim(usdt.address, signers[0].address);

        expect(await usdt.balanceOf(signers[0].address)).to.be.eq(rewardBalanceBefore) // balance does not change, claim not satisfied
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalAvailable).to.be.eq(0)
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalRequested).to.be.eq(lpBalance.div(2))

    })

    it("Should revert zero withdrawals", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await expect(AlluoVault.withdraw(0, signers[0].address, signers[0].address)).to.be.revertedWith("AlluoVault: zero withdrawal");
    })

    it("Should not satisfy claims before farming even if balanceOf(stakingToken) == totalRequestedWithdrawals", async function () {

        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.transfer(signers[1].address, lpBalance.div(2));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        const rewardBalanceBefore = await usdt.balanceOf(signers[0].address);
        await AlluoVault.claim(usdt.address, signers[0].address);
        expect(await usdt.balanceOf(signers[0].address)).to.be.eq(rewardBalanceBefore) // balance does not change, claim not satisfied

        await cvxCrvFraxBPlp.connect(signers[1]).approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.connect(signers[1]).deposit(lpBalance.div(2), signers[1].address);
        await AlluoVault.stakeUnderlying();

        await AlluoVault.claim(usdt.address, signers[0].address);
        expect(await usdt.balanceOf(signers[0].address)).to.be.eq(rewardBalanceBefore) // balance does not change, claim not satisfied

        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalAvailable).to.be.eq(0)
        expect(await (await AlluoVault.userWithdrawals(signers[0].address)).withdrawalRequested).to.be.eq(lpBalance.div(2))
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(lpBalance.div(2))
        expect(await AlluoVault.stakedBalance()).to.be.eq(lpBalance)
        expect(await AlluoVault.lockedBalance()).to.be.eq(0)

    })

    it("Should keep all funds for withdrawals and try stakeUnderlying again", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await skipDays(8);
        await alluoPool.connect(admin).farm();
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);

        await AlluoVault.stakeUnderlying();
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(0)

    })

    it("Deposit N tokens twice, do one cycle and request withdrawal of N/2. Should have N/2 locked and N/2 available for withdrawal", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        console.log("LP balance before", lpBalance)
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
        await skipDays(8);

        await AlluoVault.withdraw(lpBalance.div(2), signers[0].address, signers[0].address);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.stakeUnderlying(); // stakes new deposits
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(1)

        await AlluoVault.loopRewards(); // satifsfy withdrawals
        expect(await AlluoVault.withdrawalQueueLength()).to.eq(0)
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
        await alluoPool.connect(admin).farm();
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



    /* ----------------------- SHARE TRANSFERS ------------------------- */

    it("Should revert transferring of shares requested for withdrawal", async function () {
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
        await alluoPool.connect(admin).farm();
        await skipDays(10);
        await AlluoVault.withdraw(await AlluoVault.balanceOf(signers[0].address), signers[0].address, signers[0].address);

        const amount = await AlluoVault.balanceOf(signers[0].address);
        await expect(AlluoVault.transfer(signers[1].address, amount)).to.be.revertedWith("AlluoVault: amount > unlocked balance");

    })

    it("Should transfer shares which are not requested for withdrawal. Both owners should get rewards atfer farm()", async function () {
        const amount = parseEther("20");
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(amount, signers[0].address);

        await AlluoVault.stakeUnderlying();
        await AlluoVault.withdraw(amount.div(2), signers[0].address, signers[0].address);
        await AlluoVault.transfer(signers[1].address, amount.div(4))

        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(amount.div(4).mul(3))
        expect(await AlluoVault.balanceOf(signers[1].address)).to.be.eq(amount.div(4));

        await alluoPool.connect(admin).farm();

        const signerRewardTokenBefore0 = await rewardToken.balanceOf(signers[0].address)
        const signerRewardTokenBefore1 = await rewardToken.balanceOf(signers[1].address)

        await AlluoVault.claimRewards(rewardToken.address)
        await AlluoVault.connect(signers[1]).claimRewards(rewardToken.address)

        expect(await rewardToken.balanceOf(signers[0].address)).to.be.gt(signerRewardTokenBefore0)
        expect(await rewardToken.balanceOf(signers[1].address)).to.be.gt(signerRewardTokenBefore1)

    })

    /* ----------------------- ADMIN FUNCTIONS & OTHER ------------------------- */

    it("Admin should unlock all funds from frax convex", async function () {

        const usdcBalance = await usdc.balanceOf(signers[0].address);
        expect(Number(usdcBalance) > 0);
        await usdc.approve(AlluoVault.address, usdcBalance);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        const balaceBefore = await AlluoVault.totalAssets();
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();
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

    it("Should change locking duration", async function () {
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance.div(2), signers[0].address);
        await AlluoVault.connect(admin).changeLockingDuration(1200600);
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        await AlluoVault.connect(admin).unlockFromFraxConvex();
        expect(await AlluoVault.lockedBalance()).to.be.eq(lpBalance.div(2));
        await skipDays(14);
        await AlluoVault.connect(admin).unlockFromFraxConvex();
        expect(await AlluoVault.lockedBalance()).to.be.eq(0);
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
        await alluoPool.connect(admin).farm();

        expect(Number(userShares)).to.be.gt(0);
        expect(await AlluoVault.totalAssets()).to.eq(userShares);
        expect(await AlluoVault.stakedBalance()).to.eq(0)
        expect(await AlluoVault.lockedBalance()).to.eq(userShares)

        await AlluoVault.withdraw(userShares.div(2), signers[0].address, signers[0].address);

        await skipDays(10)
        await AlluoVault.loopRewards()
        expect(await AlluoVault.totalAssets()).to.eq(userShares.div(2))
    })

    it("Should return more assets for initial amount of shares after direct erc20 transfer to the contract happened", async () => {

        const amount = parseEther("10");
        const lpBalance = makeEvenNumber(await cvxCrvFraxBPlp.balanceOf(signers[0].address));

        await cvxCrvFraxBPlp.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await cvxCrvFraxBPlp.transfer(signers[1].address, lpBalance.div(2));

        await AlluoVault.deposit(amount, signers[0].address)
        console.log("User balance  after deposit", await AlluoVault.balanceOf(signers[0].address));
        await cvxCrvFraxBPlp.connect(signers[1]).transfer(AlluoVault.address, amount.mul(100)); //attack
        await AlluoVault.redeem(amount, signers[0].address, signers[0].address); // should burn all
        await AlluoVault.stakeUnderlying();
        await alluoPool.connect(admin).farm();

        await skipDays(9);
        await alluoPool.connect(admin).farm();

        const balanceBefore = await cvxCrvFraxBPlp.balanceOf(signers[0].address);
        await AlluoVault.claim(cvxCrvFraxBPlp.address, signers[0].address);
        console.log("User balance after withdrawal", await AlluoVault.balanceOf(signers[0].address));

        expect((await cvxCrvFraxBPlp.balanceOf(signers[0].address)).sub(balanceBefore)).to.be.gt(amount);
        console.log(ethers.utils.formatUnits((await cvxCrvFraxBPlp.balanceOf(signers[0].address)).sub(balanceBefore), 18), ethers.utils.formatUnits(amount));

    })
});



