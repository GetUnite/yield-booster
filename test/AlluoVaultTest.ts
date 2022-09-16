import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";
import { before } from "mocha";
import { AlluoVaultUpgradeable, CVXETHAlluoPool, IAlluoPool, ICurvePool, ICvxBooster, IERC20MetadataUpgradeable, IExchange } from "../typechain";


async function getImpersonatedSigner(address: string): Promise<SignerWithAddress> {
    await ethers.provider.send(
        'hardhat_impersonateAccount',
        [address]
    );

    return await ethers.getSigner(address);
}

async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

describe("Alluo Vault Tests", function() {
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable, crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable;
    let cvxBooster: ICvxBooster;
    let exchange: IExchange;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault : AlluoVaultUpgradeable;
    let rewardToken :IERC20MetadataUpgradeable;
    let fraxUSDC : IERC20MetadataUpgradeable;
    let alluoPool : IAlluoPool;

    before(async function () {
        //We are forking Polygon mainnet, please set Alchemy key in .env
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 15426472,
                },
            },],
        });

    })

    before(async () => {
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        usdt = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
        crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
        cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        cvxBooster = await ethers.getContractAt("ICvxBooster", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
        exchange = await ethers.getContractAt("IExchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        fraxUSDC =  await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC");
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");

        const value = parseEther("2000.0");

        await exchange.exchange(
            ZERO_ADDR, frax.address, value, 0, { value: value }
        )

    });

    beforeEach(async () => {
        const fraxUSDCPool=  await ethers.getContractAt("ICurvePool", "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2")
        await frax.approve(fraxUSDCPool.address, ethers.constants.MaxUint256)
        await fraxUSDCPool.add_liquidity([parseEther("1000"),0],0);
        let gnosis = "0x6b140e772aCC4D5E0d5Eac3813D586aa6DB8Fbf7";
        let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
        
        AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
            "Frax-USDC Vault",
            "abFraxUSDC",
            fraxUSDC.address,
            rewardToken.address,
            rewardToken.address,
            gnosis,
            gnosis,
            [crv.address, cvx.address],
            100
        ],  {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoVaultUpgradeable;

        let PoolVaultFactory = await ethers.getContractFactory("CVXETHAlluoPool");
        alluoPool = await upgrades.deployProxy(PoolVaultFactory, [
            rewardToken.address,
            gnosis,
            [crv.address, cvx.address],
            "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address
            64, //Pool number convex
            AlluoVault.address,
            cvx.address
        ]) as CVXETHAlluoPool
        await AlluoVault.setPool(alluoPool.address);

    });
    it("Deposit some LP", async function() {
        const lpBalance = await fraxUSDC.balanceOf(signers[0].address);
        console.log("Balance before of FRAX-USDC Lp", lpBalance)
        await fraxUSDC.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        console.log("Shares after", await AlluoVault.balanceOf(signers[0].address));
        expect(Number(await AlluoVault.balanceOf(signers[0].address))).greaterThan(0);
        expect(Number(lpBalance)).equal(Number(await AlluoVault.balanceOf(signers[0].address)));
    })
   
    it("Deposit some LP and wait for rewards to accumulate", async function() {
        const lpBalance = await fraxUSDC.balanceOf(signers[0].address);
        console.log("Balance before of FRAX-USDC Lp", lpBalance)
        await fraxUSDC.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
    })
    it("Wait for rewards then loop rewards.", async function() {
        const lpBalance = await fraxUSDC.balanceOf(signers[0].address);
        console.log("Balance before of FRAX-USDC Lp", lpBalance)
        await fraxUSDC.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await AlluoVault.loopRewards();
        console.log("crv-ETH staked", await alluoPool.fundsLocked());
        expect(Number(await alluoPool.fundsLocked())).greaterThan(0);
    })

    it("After looping rewards, expect fundsLocked to increase.", async function() {
        const lpBalance = await fraxUSDC.balanceOf(signers[0].address);
        console.log("Balance before of FRAX-USDC Lp", lpBalance)
        await fraxUSDC.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await AlluoVault.loopRewards();
        const initialRewards = await alluoPool.fundsLocked();


        await skipDays(0.01);
        await alluoPool.claimRewardsFromPool();
        
        
        const crvAccumulated = await crv.balanceOf(alluoPool.address);
        const cvxAccumulated = await cvx.balanceOf(alluoPool.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)


        await alluoPool.farm();
        const compoundedRewards = await alluoPool.fundsLocked();

        console.log("crv-ETH staked after", await alluoPool.fundsLocked());
        expect(Number(compoundedRewards)).greaterThan(Number(initialRewards));
    })

    it("Deposit some Lp for vault tokens and then burn them for the same LPs back.", async function() {
        const lpBalance = await fraxUSDC.balanceOf(signers[0].address);
        await fraxUSDC.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await AlluoVault.loopRewards();
       
        await AlluoVault.withdraw(lpBalance, signers[0].address, signers[0].address);
        await AlluoVault.claimRewards();

        expect(await AlluoVault.balanceOf(signers[0].address)).equal(0)
        expect(await fraxUSDC.balanceOf(signers[0].address)).equal(lpBalance)
        console.log("Rewardsin LP", Number(await rewardToken.balanceOf(signers[0].address)));
        expect(Number(await rewardToken.balanceOf(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault.totalAssets())).equal(0)
        expect(Number(await AlluoVault.totalSupply())).equal(0)
    })

})